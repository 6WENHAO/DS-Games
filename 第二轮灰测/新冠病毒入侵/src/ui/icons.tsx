/** 界面图标：全部内联 SVG，零外部资源、可随字号缩放。 */

interface IconProps {
  size?: number
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const IconPlay = ({ size = 18 }: IconProps) => (
  <svg {...base(size)} fill="currentColor" stroke="none">
    <path d="M8 5.6a1 1 0 0 1 1.5-.87l9 5.4a1 1 0 0 1 0 1.74l-9 5.4A1 1 0 0 1 8 16.4z" />
  </svg>
)

export const IconPause = ({ size = 18 }: IconProps) => (
  <svg {...base(size)} fill="currentColor" stroke="none">
    <rect x="7" y="5" width="3.4" height="14" rx="1.2" />
    <rect x="13.6" y="5" width="3.4" height="14" rx="1.2" />
  </svg>
)

export const IconPrev = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M17.5 5.5v13M14 12 6.5 6.6v10.8z" fill="currentColor" stroke="currentColor" />
  </svg>
)

export const IconNext = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M6.5 5.5v13M10 12l7.5-5.4v10.8z" fill="currentColor" stroke="currentColor" />
  </svg>
)

export const IconLoop = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 9.5A5.5 5.5 0 0 1 9.5 4H17l-2.5-2.4M20 14.5A5.5 5.5 0 0 1 14.5 20H7l2.5 2.4" />
  </svg>
)

export const IconLabel = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h7.6a2 2 0 0 1 1.5.7l4.3 4.8-4.3 4.8a2 2 0 0 1-1.5.7H5.5a2 2 0 0 1-2-2z" />
    <circle cx="8" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)

export const IconRotate = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <ellipse cx="12" cy="12" rx="9" ry="3.6" />
    <path d="M6 6.6A9 9 0 1 1 5.2 15" />
    <path d="M4.4 11.6 5.2 15l3.3-1" />
  </svg>
)

export const IconLayers = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 3.5 3.5 8l8.5 4.5L20.5 8z" />
    <path d="M3.5 12.5 12 17l8.5-4.5" />
    <path d="M3.5 16.5 12 21l8.5-4.5" />
  </svg>
)

export const IconBook = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z" />
  </svg>
)

export const IconHelp = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.5-1.2 1-1.2 1.9" />
    <circle cx="12" cy="17.1" r="0.9" fill="currentColor" stroke="none" />
  </svg>
)

export const IconChevron = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
)

export const IconChevronDown = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export const IconTarget = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="7.6" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M12 2.6v2.4M12 19v2.4M2.6 12h2.4M19 12h2.4" />
  </svg>
)

export const IconGauge = ({ size = 17 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4.4 17a9 9 0 1 1 15.2 0" />
    <path d="M12 12.6 15.8 9" />
    <circle cx="12" cy="13.4" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)
