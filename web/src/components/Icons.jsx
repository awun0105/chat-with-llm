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

/* safelist for tailwind v4 scanner bug with default params: 
   size-[15px] size-4.5 size-[22px]
*/
const twSafelist = "size-[15px] size-4.5 size-[22px]";

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
