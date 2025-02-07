import React from 'react';
export const Terminal = props => (
  <svg viewBox="0 0 20 20"  {...props} className={`sketchybar-app-font ${props.className ? props.className : ''}`}><path d="M9.67432 12.8243L2.38645 20.1121C2.03496 20.4636 1.46511 20.4636 1.11366 20.1121L0.263607 19.2621C-0.0872808 18.9112 -0.0879557 18.3425 0.262107 17.9908L6.03794 12.1878L0.262145 6.38491C-0.0879182 6.0332 -0.0872432 5.46451 0.263645 5.11363L1.11366 4.26362C1.46515 3.91213 2.035 3.91213 2.38645 4.26362L9.67432 11.5515C10.0258 11.9029 10.0258 12.4728 9.67432 12.8243ZM24 19.6878V18.4878C24 17.9908 23.5971 17.5878 23.1 17.5878H11.7C11.203 17.5878 10.8 17.9908 10.8 18.4878V19.6878C10.8 20.1849 11.203 20.5878 11.7 20.5878H23.1C23.5971 20.5878 24 20.1849 24 19.6878Z" fillRule="evenodd" /></svg>
);
