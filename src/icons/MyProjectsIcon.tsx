import { SVGProps } from 'react';

const MyProjectsIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <rect x="4" y="7" width="16" height="12" rx="3" />
    <path d="M9 7V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
    <path d="M8 13.5h6" />
    <path d="M8 10.5h3" />
    <path d="M8 16.5h4.5" />
  </svg>
);

export default MyProjectsIcon;
