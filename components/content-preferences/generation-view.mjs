// Presentation-only helpers. The server remains responsible for full schema validation.
const formats = { video_script: 'Video script', text_post: 'Post', carousel: 'Carousel', caption: 'Caption', other: 'Content' };
const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const string = value => typeof value === 'string';
const nonempty = value => string(value) && value.trim().length > 0;
const strings = value => Array.isArray(value) && value.every(nonempty);

export function validateGenerationResponse(payload) {
  const result = payload?.result;
  let valid = object(payload) && nonempty(payload.model) && nonempty(payload.provider)
    && object(result) && result.schema_version === '1.0' && result.skill === 'idea-to-content'
    && ['ready', 'partial', 'needs_input'].includes(result.status) && nonempty(result.title)
    && string(result.summary) && ['assumptions', 'questions', 'limitations'].every(key => strings(result[key]));
  if (valid && result.status === 'needs_input') valid = result.data === null && result.questions.length > 0;
  else if (valid) {
    const data = result.data;
    valid = object(data) && object(data.brief)
      && ['source_idea', 'audience', 'goal', 'tone'].every(key => nonempty(data.brief[key])) && strings(data.brief.platforms)
      && object(data.selected_angle) && ['title', 'takeaway', 'reason'].every(key => nonempty(data.selected_angle[key]))
      && Array.isArray(data.hooks) && data.hooks.every(hook => object(hook) && nonempty(hook.id) && nonempty(hook.text))
      && strings(data.review_notes) && Array.isArray(data.assets) && data.assets.length > 0
      && data.assets.every(asset => object(asset) && ['id', 'platform', 'title', 'content'].every(key => nonempty(asset[key]))
        && Object.hasOwn(formats, asset.format) && ['hook_id', 'caption', 'call_to_action'].every(key => asset[key] === null || string(asset[key]))
        && strings(asset.production_notes))
      && (result.status !== 'ready' || result.questions.length === 0)
      && (result.status !== 'partial' || result.limitations.length > 0);
  }
  if (!valid) throw new Error('The model returned an invalid content result. Try again.');
  return payload;
}

export function renderContent(root, result, onCopy) {
  root.replaceChildren();
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const list = values => {
    const el = node('ul');
    values.forEach(value => el.append(node('li', value)));
    return el;
  };
  const disclosure = (parent, label, values) => {
    if (!values.length) return;
    const details = node('details');
    details.append(node('summary', label), list(values));
    parent.append(details);
  };
  const copy = (parent, label, text) => {
    const button = node('button', label);
    button.type = 'button';
    button.dataset.copy = 'true';
    button.addEventListener('click', () => onCopy(text));
    parent.append(button);
  };
  if (result.status === 'needs_input') root.append(node('p', result.summary), list(result.questions));
  for (const asset of result.data?.assets ?? []) {
    const article = node('article', undefined, 'asset');
    article.append(node('p', `${formats[asset.format]} · ${asset.platform}`, 'asset-kind'), node('h3', asset.title));
    article.append(node('p', asset.content, 'content-copy'));
    copy(article, `Copy ${formats[asset.format].toLowerCase()}`, asset.content);
    if (asset.caption && asset.caption !== asset.content) {
      article.append(node('p', 'Caption', 'caption-label'), node('p', asset.caption, 'content-copy'));
      copy(article, 'Copy caption', asset.caption);
    }
    // The CTA is already part of the asset. Never append it a second time.
    disclosure(article, 'Production notes', asset.production_notes);
    root.append(article);
  }
  const guidance = [result.summary, ...result.assumptions, ...result.limitations, ...(result.data?.review_notes ?? [])].filter(Boolean);
  if (result.status !== 'needs_input') guidance.push(...result.questions);
  if (result.data?.selected_angle) guidance.push(`Angle: ${result.data.selected_angle.title}. ${result.data.selected_angle.takeaway}`);
  disclosure(root, 'User guidance', guidance);
  disclosure(root, 'Hook options', result.data?.hooks.map(hook => hook.text) ?? []);
}
