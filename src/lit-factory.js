/*
 * A sample tagged template literal library inspired by lit-html.
 * 
 * This uses its own parser, but creates the same ElementFactory objects defined
 * by the browser.
 */


import { findNodeAddress } from './nodeAddress.js';
import { parse } from './parser.js';
import { TextContentUpdater, UpdaterDescriptor } from './updaters.js';
import ElementFactory from './ElementFactory.js';


// Constants used by our simple parser.
const marker = '**marker**';
const commentText = `<!--${marker}-->`;

// Factories we've constructed for tagged template literals we've seen.
const factories = new Map();

// Updaters for containers we've rendered.
const updaters = new WeakMap();


/*
 * HTML template tag.
 *
 * This is intended to be invoked as a JavaScript tagged template literal
 * function. This will pass in the set of stings which are HTML fragments, and a
 * set of values.
 *
 * This returns an element factory and the original set of values.
 */
export function html(strings, ...values) {
  // Do we already have a parameterized template for this set of strings?
  let factory = factories.get(strings);
  if (!factory) {
    factory = factoryFromHTMLFragments(strings);
    // Remember the parameterized template for next time.
    factories.set(strings, factory);
  }
  return {
    factory,
    values
  };
}


/*
 * Given the result of the html template literal function above, render that
 * result into the indicated container. The first time this is called, the
 * existing contents of the container will be entirely replaced. Subsequent
 * calls will simply update the content with new data.
 */
export function render(litResult, container) {
  const { factory, values } = litResult;
  if (!updaters.get(container)) {
    // Initial render.
    // Remove existing content.
    while (container.childNodes.length > 0) {
      container.childNodes[0].remove();
    }
    // Instantiate and save our updater for later renders.
    const { instance, updater } = factory.instantiate(values);
    container.appendChild(instance);
    updaters.set(container, updater);
  } else {
    // Subsequent render, just update.
    updaters.get(container).update(values);
  }
}


/*
 * Given a set of strings representing consecutive fragments of HTML,
 * return a parameterized template that can be instantiated (with data)
 * to obtain complete HTML.
 * 
 * This is a limited, quick-and-dirty implementation that can only handle
 * substitutions into text nodes, not attributes or node sequences.
 */
function factoryFromHTMLFragments(strings) {

  // Concatenate the strings to form HTML.
  // Insert comments to mark those points in the tree that will need updaters.
  const html = strings.map((string, index) =>
    `${string}${index < strings.length - 1 ? commentText : ''}`
  ).join('');

  // Convert the HTML to a document fragment.
  const template = document.createElement('template');
  template.innerHTML = html;
  const fragment = template.content;

  // Walk the fragment to find the marker nodes.
  const markers = [...findMarkers(fragment)];

  // Create an updater for each marker.
  const updaterDescriptors = markers.map((marker, index) => {
    const address = findNodeAddress(fragment, marker);
    const expression = index.toString();
    return new UpdaterDescriptor(address, TextContentUpdater, expression);
  });

  // Replace the markers with text nodes for the updaters to update.
  markers.forEach(marker =>
    marker.parentNode.replaceChild(new Text(), marker)
  );
  
  // Create and return an element factory.
  const factory = new ElementFactory();
  factory.content.appendChild(fragment);
  factory.updaterDescriptors = updaterDescriptors;
  return factory;
}


// Generate the set of marker nodes in the given fragment.
function* findMarkers(fragment) {
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_COMMENT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeValue === marker) {
      yield node;
    }
  }
}
