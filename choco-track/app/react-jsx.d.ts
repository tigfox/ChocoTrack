import "react";

// React 19 moved JSX typings to the React namespace. App Bridge still declares <s-app-nav> in the old
// global one, so declare it here.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
