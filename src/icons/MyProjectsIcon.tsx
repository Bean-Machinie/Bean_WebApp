import { SVGProps } from 'react';

const MyProjectsIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="24px"
    height="24px"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
<rect x="3" y="4" width="18" height="5" rx="1" stroke="#ffffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M5 9H19V18C19 19.1046 18.1046 20 17 20H7C5.89543 20 5 19.1046 5 18V9Z" stroke="#ffffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M10 13H14" stroke="#ffffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
);

export default MyProjectsIcon;