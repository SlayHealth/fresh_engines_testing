// Exact icon paths ported from contexts/ui_mobile_update.html's SVG sprite, so
// the mobile screens use the mockup's own line icons (stroke 1.7, these exact
// shapes) rather than a lucide approximation. Class "ico" / "ico sm" is styled
// by mobile-shell.css.
const PATHS = {
  home: <path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5V15h-7v5.5H5A1.5 1.5 0 0 1 3.5 19Z" />,
  clip: <><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1H9Z" /><path d="M9 11h6M9 15h4" /></>,
  chat: <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.3A8 8 0 1 1 20 12Z" />,
  chart: <path d="M5 20V11M12 20V4M19 20v-6" />,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7Z" /><path d="M13.7 20a2 2 0 0 1-3.4 0" /></>,
  chev: <path d="m9 5 7 7-7 7" />,
  down: <path d="m5 9 7 7 7-7" />,
  arrow: <path d="M5 12h13M13 6l6 6-6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  pencil: <path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5Z" />,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" /></>,
  pulse: <path d="M3 12.5h3.5L9 6l3.5 12 2.5-8 1.8 2.5H21" />,
  mind: <><circle cx="12" cy="12" r="8.6" /><path d="M12 16.4s-3.3-2-3.3-4.2a1.9 1.9 0 0 1 3.3-1.3 1.9 1.9 0 0 1 3.3 1.3c0 2.2-3.3 4.2-3.3 4.2Z" /></>,
  flask: <><path d="M9.5 3h5" /><path d="M10.5 3v5.6L5.7 17a2 2 0 0 0 1.7 3h9.2a2 2 0 0 0 1.7-3l-4.8-8.4V3" /><path d="M8.2 14.5h7.6" /></>,
  scan: <><path d="M4 8.5V6a2 2 0 0 1 2-2h2.5" /><path d="M15.5 4H18a2 2 0 0 1 2 2v2.5" /><path d="M20 15.5V18a2 2 0 0 1-2 2h-2.5" /><path d="M8.5 20H6a2 2 0 0 1-2-2v-2.5" /><path d="M4.5 12h15" /></>,
  dna: <><path d="M7 3c0 4 10 5 10 9s-10 5-10 9" /><path d="M17 3c0 4-10 5-10 9s10 5 10 9" /><path d="M8.6 7.5h6.8M8.6 16.5h6.8" /></>,
  shield: <><path d="M12 3.2 5 6v5.5c0 4.3 2.9 8.1 7 9.3 4.1-1.2 7-5 7-9.3V6Z" /><path d="m9.3 12 1.9 1.9 3.6-3.7" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 3c0 4.8-7.5 9.4-7.5 9.4Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  dl: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M4.5 19.5h15" /></>,
  share: <><circle cx="17" cy="6" r="2.6" /><circle cx="6.5" cy="12" r="2.6" /><circle cx="17" cy="18" r="2.6" /><path d="m8.8 10.7 5.9-3.4M8.8 13.3l5.9 3.4" /></>,
  send: <><path d="M20 4 3.5 10.8l6.6 2.1 2.1 6.6Z" /><path d="M20 4 10.1 12.9" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c4 4.5 4 12.5 0 17-4-4.5-4-12.5 0-17Z" /></>,
  file: <><path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5Z" /><path d="M13.5 3v5.5H19" /></>,
  out: <><path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8" /><path d="M17 8.5 20.5 12 17 15.5M20 12H9.5" /></>,
  trash: <><path d="M4.5 6.5h15M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7" /><path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" /></>
};

export default function Ico({ name, sm = false, className = '' }) {
  const cls = `ico${sm ? ' sm' : ''}${className ? ' ' + className : ''}`;
  return (
    <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name] || null}
    </svg>
  );
}
