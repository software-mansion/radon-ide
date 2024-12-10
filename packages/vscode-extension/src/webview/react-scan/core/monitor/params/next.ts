'use client';

// adapted from vercel analytics <remember to put link here>
import { useParams, usePathname, useSearchParams } from 'next/navigation.js';
// import React from 'react';
import { createElement } from 'react';
import { BaseMonitor } from '..';
import { computeRoute } from './utils';
// import { computeRoute } from '../utils';
// does this work in pages and app router? Idk
const useRoute = (): {
  route: string | null;
  path: string;
} => {
  const params = useParams();
  const searchParams = useSearchParams();
  const path = usePathname();

  // Until we have route parameters, we don't compute the route
  if (!params) {
    return { route: null, path };
  }
  // in Next.js@13, useParams() could return an empty object for pages router, and we default to searchParams.
  const finalParams = Object.keys(params).length
    ? (params as Record<string, string | Array<string>>)
    : Object.fromEntries(searchParams.entries());
  return { route: computeRoute(path, finalParams), path };
};

export function Monitoring(props: { url?: string; apiKey: string }) {
  const { route, path } = useRoute();

  // we need to fix build so this doesn't get compiled to preact jsx
  return createElement(BaseMonitor, {
    ...props,
    route,
    path,
  });
}
