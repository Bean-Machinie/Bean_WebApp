import { SVGProps } from 'react';

const NewProjectIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...props}
  >
    <path d="M7.5 4.5h6.25L17.5 8v11a1.5 1.5 0 0 1-1.5 1.5h-8.5A1.5 1.5 0 0 1 6 19V6a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="M13 4.5V8h3.5" />
    <path d="M10.5 12h0" />
    <path d="M12 12v5" />
    <path d="M9.5 14.5h5" />
  </svg>
);

export default NewProjectIcon;
