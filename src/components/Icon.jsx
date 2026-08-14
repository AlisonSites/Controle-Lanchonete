const paths = {
  plate: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 3a6 6 0 110 12 6 6 0 010-12zm0 2.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z',
  ticket: 'M4 7a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V7zm5 0v10m0-10l-.01.01M9 12h.01M9 17h.01',
  check: 'M20 6L9 17l-5-5',
  burger: 'M4 8h16M4 12h16M4 16h16M6 8a6 6 0 0112 0M6 16a6 6 0 0012 0',
  tag: 'M20.59 13.41L11 4H4v7l9.59 9.59a2 2 0 002.82 0l4.18-4.18a2 2 0 000-2.82zM7 8a1 1 0 110-2 1 1 0 010 2z',
  table: 'M3 6h18M5 6v13M19 6v13M3 10h18M9 10v9M15 10v9',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z',
  lock: 'M6 11V8a6 6 0 1112 0v3M5 11h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1z',
  chart: 'M4 20V10m6 10V4m6 16v-7m6 7V8',
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M18 6L6 18M6 6l12 12',
  print: 'M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-6a1 1 0 011-1h16a1 1 0 011 1v6a1 1 0 01-1 1h-2M6 14h12v7H6v-7z',
  trash: 'M4 7h16M9 7V4h6v3m-8 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13',
  edit: 'M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  qrcode: 'M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm12 0h2v2h-2v-2zm4 0h2v6h-6v-2h4v-4zm-4 4h2v2h-2v-2z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-4.35-4.35',
  arrowLeft: 'M19 12H5m0 0l6-6m-6 6l6 6',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 21h16',
  cart: 'M3 4h2l2.4 12.4a2 2 0 002 1.6h8.2a2 2 0 002-1.94L21 8H6',
  clock: 'M12 7v5l3 3M12 21a9 9 0 100-18 9 9 0 000 18z',
}

export default function Icon({ name, size = 20, strokeWidth = 1.8, className = '' }) {
  const d = paths[name] || paths.home
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon icon-${name} ${className}`}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}
