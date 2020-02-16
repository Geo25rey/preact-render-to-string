import { encodeEntities, styleObjToCss, assign } from './util';
import { options } from 'preact';

const VOID_ELEMENTS = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;

const UNSAFE_NAME = /[\s\n\\/='"\0<>]/;

/**
 * Render Preact JSX + Components to an HTML string.
 * @param {import('preact').VNode} vnode	A Virtual DOM element to render.
 */
export default function (vnode) {
	return renderVNode(vnode, {}, undefined);
}

/**
 * Render a Virtual DOM element (of any kind) to HTML.
 * @param {import('preact').VNode|Array<any>|string|number|boolean|null|undefined} vnode any renderable value
 * @param {object} context context object, forks throughout the tree
 * @param {any} selectValue the current select value, passed down through the tree to set <options selected>
 */
function renderVNode(vnode, context, selectValue) {
	if (vnode == null || vnode === false || vnode === true) {
		return '';
	}

	if (typeof vnode !== 'object') {
		return encodeEntities(vnode);
	}

	if (Array.isArray(vnode)) {
		let s = '';
		for (let i=0; i<vnode.length; i++) {
			s += renderVNode(vnode[i], context, selectValue);
		}
		return s;
	}


	let nodeName = vnode.type,
		props = vnode.props;

	context = context || {};

	// components
	if (typeof nodeName === 'function') {
		let rendered;

		let c = vnode.__c = { __v: vnode, context, props: vnode.props, __h: [] };

		// options.render
		if (options.__r) options.__r(vnode);

		let cxType = nodeName.contextType;
		let provider = cxType && context[cxType.__c];
		let cctx = cxType != null ? (provider ? provider.props.value : cxType.__) : context;

		if (!('prototype' in nodeName) || !('render' in nodeName.prototype)) {
			// Necessary for createContext api. Setting this property will pass
			// the context value as `this.context` just for this component.

			// stateless functional components
			rendered = nodeName.call(c, props, cctx);
		}
		else {
			c = vnode.__c = new nodeName(props, cctx);
			c.__v = vnode;
			// turn off stateful re-rendering:
			c._dirty = c.__d = true;
			c.props = props;
			if (c.state==null) c.state = {};

			if (c._nextState==null && c.__s==null) {
				c._nextState = c.__s = c.state;
			}

			c.context = cctx;
			if ('getDerivedStateFromProps' in nodeName) {
				c.state = assign(assign({}, c.state), nodeName.getDerivedStateFromProps(c.props, c.state));
			}
			else if ('componentWillMount' in c) {
				c.componentWillMount();
			}

			// If the user called setState in cWM we need to flush pending,
			// state updates. This is the same behaviour in React.
			c.state = c._nextState !== c.state
				? c._nextState : c.__s!==c.state
					? c.__s : c.state;

			rendered = c.render(c.props, c.state, c.context);
		}

		if ('getChildContext' in c) {
			context = assign(assign({}, context), c.getChildContext());
		}

		return renderVNode(rendered, context, selectValue);
	}

	if (UNSAFE_NAME.test(nodeName)) return '';

	let html = '';
	let s = '<';
	s += nodeName;

	if (props) {
		for (let name in props) {
			let v = props[name];
			let type;
			if (name === 'children' || name === 'key' || name === 'ref' || UNSAFE_NAME.test(name)) {
				// skip
			}
			else if (nodeName === 'option' && name === 'value' && selectValue === v) {
				s += ' selected';
				selectValue = undefined;
			}
			else if (nodeName === 'select' && name === 'value') {
				selectValue = v;
			}
			else if (name === 'dangerouslySetInnerHTML') {
				html = v && v.__html;
			}
			else if ((v || v===0) && (type = typeof v) !== 'function') {
				if (name === 'style' && type === 'object') {
					v = styleObjToCss(v);
				}
				else if (name.substring(0,5) === 'xlink') {
					// this doesn't actually need to be limited to SVG, since attributes "xlinkHref" are invalid anyway
					name = name.replace(/^xlink([A-Z])/, 'xlink:$1');
				}
				s += ' ';
				s += name;
				if (v !== true && v !== '') {
					s += '="';
					s += encodeEntities(v);
					s += '"';
				}
			}
		}
	}

	let isVoid = VOID_ELEMENTS.test(nodeName);
	if (isVoid) {
		s += ' />';
	}
	else {
		s += '>';
	}

	if (html) {
		s += html;
	}
	else if (props && props.children) {
		s += renderVNode(props.children, context, selectValue);
	}

	if (!isVoid) {
		s += '</';
		s += nodeName;
		s += '>';
	}

	return s;
}
