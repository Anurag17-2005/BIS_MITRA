function inline(text, keyPrefix) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.filter((part) => part !== '').map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    return <span key={key}>{part}</span>;
  });
}

function isHeadingLine(line) {
  const trimmed = line.trim();
  if (/^#{1,3}\s+/.test(trimmed)) return trimmed.replace(/^#{1,3}\s+/, '');
  if (/^\*\*[^*]+\*\*$/.test(trimmed)) return trimmed.slice(2, -2);
  return null;
}

function fixOrderedListNumbers(text) {
  const lines = String(text || '').split('\n');
  let i = 0;
  while (i < lines.length) {
    if (/^\s*\d+[.)]\s+/.test(lines[i])) {
      let j = i;
      let n = 1;
      while (j < lines.length && /^\s*\d+[.)]\s+/.test(lines[j])) {
        lines[j] = lines[j].replace(/^\s*\d+[.)]\s+/, `${n}. `);
        n += 1;
        j += 1;
      }
      i = j;
    } else {
      i += 1;
    }
  }
  return lines.join('\n');
}

export function RichText({ text }) {
  const lines = fixOrderedListNumbers(String(text || '')).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let list = null;
  let para = [];
  let code = null;

  const flushPara = () => {
    if (!para.length) return;
    const value = para.join(' ').trim();
    para = [];
    if (value) blocks.push({ type: 'p', text: value });
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(list);
    list = null;
  };

  lines.forEach((line) => {
    if (code) {
      if (line.trim().startsWith('```')) {
        blocks.push({ type: 'code', text: code.join('\n') });
        code = null;
      } else code.push(line);
      return;
    }
    if (line.trim().startsWith('```')) {
      flushPara();
      flushList();
      code = [];
      return;
    }
    const heading = isHeadingLine(line);
    if (heading) {
      flushPara();
      flushList();
      const level = line.trim().startsWith('###') ? 3 : line.trim().startsWith('##') ? 2 : 3;
      blocks.push({ type: 'h', level: line.trim().startsWith('# ') ? 2 : level, text: heading });
      return;
    }
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      flushPara();
      const ordered = /^\s*\d+[.)]/.test(line);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { type: 'list', ordered, items: [] };
      }
      list.items.push(bullet[1]);
      return;
    }
    if (!line.trim()) {
      flushPara();
      flushList();
      return;
    }
    flushList();
    para.push(line.trim());
  });
  flushPara();
  flushList();
  if (code) blocks.push({ type: 'code', text: code.join('\n') });

  return (
    <div className="bp-rich">
      {blocks.map((block, i) => {
        if (block.type === 'h') {
          const Tag = block.level === 2 ? 'h3' : 'h4';
          return <Tag key={i}>{inline(block.text, `h${i}`)}</Tag>;
        }
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul';
          return (
            <Tag key={i}>
              {block.items.map((item, j) => <li key={j}>{inline(item, `l${i}-${j}`)}</li>)}
            </Tag>
          );
        }
        if (block.type === 'code') return <pre key={i}><code>{block.text}</code></pre>;
        return <p key={i}>{inline(block.text, `p${i}`)}</p>;
      })}
    </div>
  );
}
