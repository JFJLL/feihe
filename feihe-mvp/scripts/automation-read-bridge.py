"""Read-only adapter over the existing automation providers; never invokes their Feishu writers."""
import contextlib,datetime,io,json,pathlib,sys,math,re
sys.stdin.reconfigure(encoding='utf-8');sys.stdout.reconfigure(encoding='utf-8')

def clean_row(row):
    clean={}
    for key,value in row.items():
        if re.search(r'cookie|authorization|token|secret|password|headers',str(key),re.I):continue
        if isinstance(value,float) and not math.isfinite(value):value=None
        if value is not None and re.search(r'(?:ID|Id|id)$',str(key)):
            if isinstance(value,float) and abs(value)>2**53:raise ValueError('平台ID数值精度无法验证')
            value=str(int(value)) if isinstance(value,float) and value.is_integer() else str(value)
        clean[key]=value
    return clean

def read_platform(request):
    root=pathlib.Path(request['automationRoot']).resolve()
    if not (root/'sync_console/platforms/registry.py').is_file():
        raise ValueError('AUTOMATION_ROOT is not the verified automation checkout')
    sys.path.insert(0,str(root/'sync_console'));sys.path.insert(0,str(root))
    # Silence provider diagnostics, which may contain upstream request information.
    with contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
        from core.business_time import latest_sync_cutoff_date
        account=request['account'];platform=request['platform']
        external=str(account.get('externalId','')).strip()
        if not external:raise ValueError('project_account_missing')
        end=request.get('to') or latest_sync_cutoff_date(platform)
        end_date=datetime.date.fromisoformat(end)
        latest=datetime.date.fromisoformat(latest_sync_cutoff_date(platform))
        delay=int(request.get('attributionDelayDays',0))
        end_date=min(end_date,latest-datetime.timedelta(days=delay))
        start=datetime.date.fromisoformat(request['from']) if request.get('from') else end_date-datetime.timedelta(days=int(request.get('refreshDays',7))-1)
        if start>end_date or (end_date-start).days>89:raise ValueError('date_range_invalid')
        entities=request.get('entityIds') or []
        if not entities:raise ValueError('project_entity_binding_missing')
        rows=[];pages=0;expected=0;results=[]
        if platform=='jzt':
            from platforms.jzt import get_jzt_subaccount_cookie,fetch_jzt_data
            cookie=get_jzt_subaccount_cookie(external)
            if not cookie:raise ValueError('指定京准通账号凭据刷新失败；未尝试其他账号')
            for entity in entities:
                result=fetch_jzt_data(entity,start.isoformat(),end_date.isoformat(),cookie=cookie,sub_account_id=external)
                results.append(result)
                rows.extend(result.rows);pages+=result.pages_fetched;expected+=result.expected_pages
        elif platform=='juguang':
            from platforms.juguang import get_juguang_subaccount_headers,fetch_juguang_data
            headers=get_juguang_subaccount_headers(external)
            if str(headers.get('v-seller-id',''))!=external or not headers.get('cookie'):
                raise ValueError('聚光凭据账号不匹配')
            dim = request.get('dimension') or 'placement'
            result=fetch_juguang_data(entities[0],dim,start.isoformat(),end_date.isoformat(),headers_override=headers,sub_account_id=external)
            results.append(result)
            if dim == 'account':
                for row in result.rows:
                    row['创意ID'] = row.get('创意ID') or row.get('creativityId') or (external + '-' + str(row.get('投放位置', 'all')))
                rows.extend(result.rows)
            else:
                allowed=set(str(x) for x in entities)
                for row in result.rows:
                    identity=str(row.get('计划ID') or row.get('campaignId') or '')
                    if identity in allowed:rows.append(row)
            pages=result.pages_fetched;expected=result.expected_pages
        elif platform=='taobao':
            from platforms.registry import fetch_oss_token
            from platforms.taobao import parse_cookie_payload,fetch_taobao_data
            # A per-account object is mandatory, independent of automation's global defaults.
            cookies=None
            for key_candidate in [f'token/taobao/{external}.txt', f'{external}.txt', 'KOL/adstar.txt']:
                try:
                    raw=fetch_oss_token(key_candidate)
                    cookies=parse_cookie_payload(raw)
                    if cookies:break
                except Exception:
                    pass
            if not cookies:raise ValueError('指定淘宝星河账号凭据刷新失败')
            for entity in entities:
                result=fetch_taobao_data(entity,request.get('dimension') or 'content',start.isoformat(),end_date.isoformat(),cookies=cookies)
                results.append(result)
                rows.extend(result.rows);pages+=result.pages_fetched;expected+=result.expected_pages
        else:
            raise ValueError('该平台账号接口尚未逐项验证，保持未连接')
        from core.models import ProviderFetchStatus
        for result in results:
            if result.expected_pages and result.pages_fetched<result.expected_pages:raise ValueError('平台分页不完整，未发布结果')
            if result.status not in (ProviderFetchStatus.SUCCESS,ProviderFetchStatus.EMPTY):raise ValueError('platform_result_failed')
    clean=[clean_row(row) for row in rows]
    return {'ok':True,'rows':clean,'accountId':external,'from':start.isoformat(),'to':end_date.isoformat(),'pages':pages,'expectedPages':expected,'credentialRefreshed':True}

if __name__=='__main__':
    try:
        request=json.loads(sys.stdin.read())
        result=read_platform(request)
    except Exception as error:
        # Report only a bounded category. Raw vendor exceptions never leave the server process.
        result={'ok':False,'errorType':type(error).__name__,'message':'指定账号读取失败；上次成功数据已保留'}
    sys.stdout.write(json.dumps(result,ensure_ascii=False,default=str,allow_nan=False))
