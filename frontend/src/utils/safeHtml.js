const BLOCKED_TAGS = 'script,style,iframe,frame,frameset,object,embed,applet,form,input,button,textarea,select,meta,link,base,svg,math,template';
const URL_ATTRIBUTES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'background', 'poster', 'srcset']);
const MEDIA_ATTRIBUTES = new Set(['src', 'srcset', 'poster', 'background']);

function isUnsafeUrl(name, value) {
  // Browsers ignore whitespace/control characters inside the scheme ("java\tscript:"), so strip them first.
  const normalized = String(value || '').replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();
  if (normalized.startsWith('javascript:') || normalized.startsWith('vbscript:')) return true;
  // data: images are harmless in media attributes but can carry HTML/script in navigable links.
  return normalized.startsWith('data:') && !MEDIA_ATTRIBUTES.has(name);
}

/** Plain text of an HTML string, parsed in an inert template so nothing loads or executes. */
export function htmlToText(value) {
  const html = String(value || '');
  if (!html) return '';
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, ' ');
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.textContent || '';
}

/**
 * Strip executable markup from user/master-authored rich text before it is
 * assigned to innerHTML or rendered with dangerouslySetInnerHTML.
 */
export function safeRichHtml(value) {
  const html = String(value || '');
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll(BLOCKED_TAGS).forEach((node) => node.remove());
  template.content.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || name === 'style' || name === 'srcdoc' || (URL_ATTRIBUTES.has(name) && isUnsafeUrl(name, attribute.value))) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return template.innerHTML;
}
