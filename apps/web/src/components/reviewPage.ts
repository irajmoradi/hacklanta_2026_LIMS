import type {Villager} from '../api/types';

export const REVIEW_PAGE_SIZE = 10;
export function reviewPage(people: Villager[], query: string, page: number) {
  const filtered = people.filter(person => person.display_name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / REVIEW_PAGE_SIZE));
  const current = Math.max(0, Math.min(page, pages - 1));
  return {people: filtered.slice(current * REVIEW_PAGE_SIZE, (current + 1) * REVIEW_PAGE_SIZE),
    count: filtered.length, pages, current};
}
