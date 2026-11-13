import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export const loader = ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  return redirect(`/app/inventory${url.search}`);
};
