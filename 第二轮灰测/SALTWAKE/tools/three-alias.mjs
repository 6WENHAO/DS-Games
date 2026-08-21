/**
 * Node loader hook that maps the bare `three` specifier onto a local three.js
 * build, so tools/smoke.mjs can execute the real application modules outside a
 * browser. The browser itself resolves `three` through the import map in
 * index.html and never sees this file.
 *
 * Point THREE_PATH at a three.js package directory (the folder containing
 * build/three.module.js) or at the module file itself.
 */
import { pathToFileURL } from 'node:url';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const CANDIDATE_SUFFIXES = [
  'build/three.module.js',
  'three/build/three.module.js',
  'node_modules/three/build/three.module.js',
];

function resolveThreeRoot() {
  const raw = process.env.THREE_PATH;
  if (!raw) return null;
  const abs = path.resolve(raw);
  if (existsSync(abs) && statSync(abs).isFile()) {
    return { module: abs, root: path.resolve(path.dirname(abs), '..') };
  }
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = path.join(abs, suffix);
    if (existsSync(candidate)) {
      return { module: candidate, root: path.resolve(path.dirname(candidate), '..') };
    }
  }
  return null;
}

const found = resolveThreeRoot();

export async function resolve(specifier, context, nextResolve) {
  if (!found) return nextResolve(specifier, context);

  if (specifier === 'three') {
    return { url: pathToFileURL(found.module).href, shortCircuit: true, format: 'module' };
  }
  if (specifier.startsWith('three/addons/')) {
    const rel = specifier.slice('three/addons/'.length);
    const file = path.join(found.root, 'examples', 'jsm', rel);
    if (existsSync(file)) {
      return { url: pathToFileURL(file).href, shortCircuit: true, format: 'module' };
    }
  }
  return nextResolve(specifier, context);
}
