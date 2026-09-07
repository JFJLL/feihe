import seedData from './notes_metadata_seed.json';

export type SeedNote = {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  category1: string;
  noteType: string;
};

const noteSeedMap = new Map<string, SeedNote>();
for (const item of (seedData as SeedNote[])) {
  if (item && item.id) {
    noteSeedMap.set(item.id, item);
  }
}

export function getSeedNote(id: string): SeedNote | undefined {
  return noteSeedMap.get(id);
}

export function getAllSeedNotes(): SeedNote[] {
  return seedData as SeedNote[];
}

