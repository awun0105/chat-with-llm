const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.8",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconClose({ className = "size-[22px]" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function IconPlus({ className = "size-4.5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconMenu({ className = "size-[22px]" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconChevron({ className = "size-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="m8 10 4 4 4-4" />
    </svg>
  );
}

export function IconInstructions({ className = "size-4.5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M4 6h16M4 12h10M4 18h7" />
    </svg>
  );
}

export function IconSend({ className = "size-4.5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="m5 12 14-7-5 14-2-6-7-1Z" />
    </svg>
  );
}

export function IconCopy({ className = "size-[15px]" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

export function IconRetry({ className = "size-[15px]" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.7-5.4L20 9" />
      <path d="M20 4v5h-5" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.7 5.4L4 15" />
      <path d="M4 20v-5h5" />
    </svg>
  );
}

export function IconSidebarClose({ className = "size-[18px]" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" {...stroke}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <path d="M9 3v18"/>
      <path d="m16 15-3-3 3-3"/>
    </svg>
  );
}

export function IconSidebarOpen({ className = "size-[18px]" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" {...stroke}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <path d="M9 3v18"/>
      <path d="m14 9 3 3-3 3"/>
    </svg>
  );
}

export function IconPen({ className = "size-[18px]" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/>
    </svg>
  );
}

export function IconSearch({ className = "size-[18px]" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

export function IconSettings({ className = "size-[18px]" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

export function IconTrash({ className = "size-[18px]" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M4 7h16M9 7V4h6v3M18 7l-1 13H7L6 7M10 11v5M14 11v5" />
    </svg>
  );
}

export function IconMore({ className = "size-[18px]" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

export function IconStop({ className = "size-[18px]" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPin({ className = "size-[18px]" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M12 17v5M9 10.5V7a3 3 0 0 1 6 0v3.5l2 3.5H7l2-3.5z" />
    </svg>
  );
}

export function IconUnpin({ className = "size-[18px]" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M12 17v5M9 10.5V7a3 3 0 0 1 6 0v3.5l2 3.5H7l2-3.5zM4 4l16 16" />
    </svg>
  );
}
