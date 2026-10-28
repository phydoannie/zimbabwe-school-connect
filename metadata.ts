export function pageHead(title: string, description: string) {
  return { meta: [{ title: `${title} — SchoolSys Pro` }, { name: 'description', content: description }, { property: 'og:title', content: `${title} — SchoolSys Pro` }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] };
}