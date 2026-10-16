import importlib.util,pathlib,sys,unittest,datetime
from unittest.mock import patch,MagicMock
app=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('bridge',app/'scripts/automation-read-bridge.py');bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
root=pathlib.Path(r'D:/download/pic-vec/automation');sys.path.insert(0,str(root/'sync_console'));sys.path.insert(0,str(root))
from core.models import ProviderFetchResult,ProviderFetchStatus
class BridgeTest(unittest.TestCase):
    def request(self):return {'automationRoot':str(root),'platform':'jzt','account':{'externalId':'scoped-account'},'entityIds':['204314'],'refreshDays':7}
    def test_missing_bound_cookie_never_uses_other_accounts(self):
        with patch('platforms.jzt.get_jzt_subaccount_cookie',return_value=None),patch('platforms.jzt.fetch_jzt_data') as fetch:
            with self.assertRaises(ValueError):bridge.read_platform(self.request())
            fetch.assert_not_called()
    def test_explicit_cookie_is_used_and_raw_credentials_do_not_leave_bridge(self):
        response=ProviderFetchResult(status=ProviderFetchStatus.SUCCESS,rows=[{'日期':'2026-10-13','任务ID':204314,'成交GMV':0,'cookie':'private-test','authorization':'private-test'}],pages_fetched=1,expected_pages=1)
        with patch('platforms.jzt.get_jzt_subaccount_cookie',return_value='test-cookie'),patch('platforms.jzt.fetch_jzt_data',return_value=response) as fetch:
            result=bridge.read_platform(self.request());self.assertEqual(fetch.call_args.kwargs['cookie'],'test-cookie');self.assertTrue(result['credentialRefreshed']);self.assertNotIn('cookie',result['rows'][0]);self.assertEqual(result['rows'][0]['任务ID'],'204314');self.assertEqual(result['rows'][0]['成交GMV'],0)
    def test_partial_pages_cannot_be_published(self):
        response=ProviderFetchResult(status=ProviderFetchStatus.SUCCESS,rows=[],pages_fetched=1,expected_pages=2)
        with patch('platforms.jzt.get_jzt_subaccount_cookie',return_value='test-cookie'),patch('platforms.jzt.fetch_jzt_data',return_value=response):
            with self.assertRaises(ValueError):bridge.read_platform(self.request())
    def test_missing_numbers_and_large_ids(self):
        self.assertIsNone(bridge.clean_row({'metric':float('nan')})['metric']);self.assertEqual(bridge.clean_row({'noteId':1234567890123456789})['noteId'],'1234567890123456789')
        with self.assertRaises(ValueError):bridge.clean_row({'noteId':float(10**18)})
    def test_failure_in_first_entity_is_not_hidden_by_success_in_last_entity(self):
        request=self.request();request['entityIds']=['204314','204315']
        failed=ProviderFetchResult(status=ProviderFetchStatus.UPSTREAM_ERROR,rows=[],pages_fetched=0,expected_pages=1)
        success=ProviderFetchResult(status=ProviderFetchStatus.SUCCESS,rows=[],pages_fetched=1,expected_pages=1)
        with patch('platforms.jzt.get_jzt_subaccount_cookie',return_value='test-cookie'),patch('platforms.jzt.fetch_jzt_data',side_effect=[failed,success]):
            with self.assertRaises(ValueError):bridge.read_platform(request)
    def test_juguang_account_dimension_id_assignment(self):
        fake_rows = [{'time': '2026-10-13', 'placementName': '信息流推广', 'fee': '100.00'}]
        fake_res = ProviderFetchResult(status=ProviderFetchStatus.SUCCESS, rows=fake_rows, pages_fetched=1, expected_pages=1)
        with patch('platforms.juguang.get_juguang_subaccount_headers', return_value={'v-seller-id': '6936b2c7252ae100150c5eed', 'cookie': 'dummy'}), \
             patch('platforms.juguang.fetch_juguang_data', return_value=fake_res):
            req = {'automationRoot': str(root), 'platform': 'juguang', 'account': {'externalId': '6936b2c7252ae100150c5eed'}, 'entityIds': ['6936b2c7252ae100150c5eed'], 'dimension': 'account', 'refreshDays': 1}
            result = bridge.read_platform(req)
            self.assertTrue(result['ok'])
            self.assertEqual(len(result['rows']), 1)
            self.assertEqual(result['rows'][0]['创意ID'], '6936b2c7252ae100150c5eed-all')
if __name__=='__main__':unittest.main()
