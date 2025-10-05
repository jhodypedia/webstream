export function slugify(s='') {
  return s.toString().toLowerCase()
    .replace(/\s+/g,'-')
    .replace(/[^\w-]+/g,'')
    .replace(/--+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,48) || 'video';
}
