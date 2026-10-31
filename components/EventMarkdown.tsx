import type { ReactNode } from "react";

/** A small, safe Markdown renderer for event descriptions. All content remains escaped React text. */
function inline(text: string): ReactNode[] {
  const pieces: ReactNode[] = [];
  const pattern = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|\`[^\`\n]+\`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) pieces.push(text.slice(last, index));
    const value = match[0];
    const key = pieces.length;
    if (value.startsWith("**") || value.startsWith("__")) pieces.push(<strong key={key} className="font-bold">{value.slice(2, -2)}</strong>);
    else if (value.startsWith("*") || value.startsWith("_")) pieces.push(<em key={key}>{value.slice(1, -1)}</em>);
    else if (value.startsWith("`")) pieces.push(<code key={key} className="rounded bg-black/5 px-1 font-mono text-[0.9em]">{value.slice(1, -1)}</code>);
    else {
      const parsed = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(value);
      if (parsed) pieces.push(<a key={key} href={parsed[2]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{parsed[1]}</a>);
    }
    last = index + value.length;
  }
  if (last < text.length) pieces.push(text.slice(last));
  return pieces;
}

export default function EventMarkdown({text}: {text:string}) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const className = level === 1 ? "mt-5 mb-2 text-xl font-bold leading-snug sm:text-2xl" : level === 2 ? "mt-4 mb-2 text-lg font-bold leading-snug sm:text-xl" : "mt-3 mb-1.5 text-base font-bold leading-snug sm:text-lg";
      const children = inline(heading[2]);
      blocks.push(level === 1 ? <h2 key={i} className={className}>{children}</h2> : level === 2 ? <h3 key={i} className={className}>{children}</h3> : <h4 key={i} className={className}>{children}</h4>);
      i++; continue;
    }
    const bullet = /^\s{0,3}[-*+]\s+(.+)$/.exec(line);
    const numbered = /^\s{0,3}\d+[.)]\s+(.+)$/.exec(line);
    if (bullet || numbered) {
      const start = i;
      const ordered = Boolean(numbered);
      const items:ReactNode[] = [];
      while (i < lines.length) {
        const item = (ordered ? /^\s{0,3}\d+[.)]\s+(.+)$/ : /^\s{0,3}[-*+]\s+(.+)$/).exec(lines[i]);
        if (!item) break;
        items.push(<li key={i}>{inline(item[1])}</li>);
        i++;
      }
      blocks.push(ordered ? <ol key={start} className="my-2 list-decimal space-y-1 pl-5">{items}</ol> : <ul key={start} className="my-2 list-disc space-y-1 pl-5">{items}</ul>);
      continue;
    }
    const start = i;
    const paragraph:string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s{0,3}(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)/.test(lines[i])) {
      paragraph.push(lines[i].trim()); i++;
    }
    blocks.push(<p key={start} className="my-2 leading-6">{paragraph.map((part,index)=><span key={index}>{index > 0 && <br/>}{inline(part)}</span>)}</p>);
  }
  return <div className="min-w-0 break-words text-sm leading-6 sm:text-base [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{blocks}</div>;
}
