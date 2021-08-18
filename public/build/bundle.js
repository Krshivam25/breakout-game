
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.29.7' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.29.7 */

    const { console: console_1 } = globals;
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	child_ctx[15] = i;
    	return child_ctx;
    }

    // (276:0) {:else}
    function create_else_block(ctx) {
    	let main;
    	let h10;
    	let t1;
    	let h11;
    	let t2;
    	let t3_value = /*game*/ ctx[0].level + "";
    	let t3;
    	let t4;
    	let t5_value = /*game*/ ctx[0].score + "";
    	let t5;
    	let t6;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h10 = element("h1");
    			h10.textContent = "Game Over";
    			t1 = space();
    			h11 = element("h1");
    			t2 = text("Level: ");
    			t3 = text(t3_value);
    			t4 = text(", Points: ");
    			t5 = text(t5_value);
    			t6 = space();
    			button = element("button");
    			button.textContent = "Play again!";
    			attr_dev(h10, "class", "svelte-kmi3tl");
    			add_location(h10, file, 277, 4, 6401);
    			attr_dev(h11, "class", "svelte-kmi3tl");
    			add_location(h11, file, 278, 4, 6425);
    			add_location(button, file, 279, 4, 6481);
    			attr_dev(main, "class", "svelte-kmi3tl");
    			add_location(main, file, 276, 2, 6389);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h10);
    			append_dev(main, t1);
    			append_dev(main, h11);
    			append_dev(h11, t2);
    			append_dev(h11, t3);
    			append_dev(h11, t4);
    			append_dev(h11, t5);
    			append_dev(main, t6);
    			append_dev(main, button);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*playAgain*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*game*/ 1 && t3_value !== (t3_value = /*game*/ ctx[0].level + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*game*/ 1 && t5_value !== (t5_value = /*game*/ ctx[0].score + "")) set_data_dev(t5, t5_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(276:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (258:0) {#if !game.gameOver}
    function create_if_block(ctx) {
    	let main;
    	let div0;
    	let p0;
    	let t0;
    	let t1_value = /*game*/ ctx[0].level + "";
    	let t1;
    	let t2;
    	let p1;
    	let t3;
    	let t4_value = /*game*/ ctx[0].lives + "";
    	let t4;
    	let t5;
    	let p2;
    	let t6;
    	let t7_value = /*game*/ ctx[0].score + "";
    	let t7;
    	let t8;
    	let div1;
    	let t9;
    	let div2;
    	let t10;
    	let div3;
    	let mounted;
    	let dispose;
    	let each_value = Array((/*game*/ ctx[0].level + 2) * 6);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			div0 = element("div");
    			p0 = element("p");
    			t0 = text("Level: ");
    			t1 = text(t1_value);
    			t2 = space();
    			p1 = element("p");
    			t3 = text("Lives: ");
    			t4 = text(t4_value);
    			t5 = space();
    			p2 = element("p");
    			t6 = text("Score: ");
    			t7 = text(t7_value);
    			t8 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t9 = space();
    			div2 = element("div");
    			t10 = space();
    			div3 = element("div");
    			add_location(p0, file, 260, 6, 5927);
    			add_location(p1, file, 261, 6, 5961);
    			add_location(p2, file, 262, 6, 5995);
    			attr_dev(div0, "class", "info-panel svelte-kmi3tl");
    			add_location(div0, file, 259, 4, 5895);
    			attr_dev(div1, "id", "brick-panel");
    			set_style(div1, "grid-template-columns", "repeat(" + (/*game*/ ctx[0].level + 2) + ", 1fr)");
    			attr_dev(div1, "class", "svelte-kmi3tl");
    			add_location(div1, file, 264, 4, 6039);
    			attr_dev(div2, "id", "ball");
    			set_style(div2, "left", /*ball*/ ctx[1].x + "px");
    			set_style(div2, "bottom", /*ball*/ ctx[1].y + "px");
    			attr_dev(div2, "class", "svelte-kmi3tl");
    			add_location(div2, file, 272, 4, 6254);
    			attr_dev(div3, "id", "paddle");
    			set_style(div3, "left", /*paddle*/ ctx[2].x + "px");
    			attr_dev(div3, "class", "svelte-kmi3tl");
    			add_location(div3, file, 273, 4, 6320);
    			attr_dev(main, "class", "svelte-kmi3tl");
    			add_location(main, file, 258, 2, 5837);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div0);
    			append_dev(div0, p0);
    			append_dev(p0, t0);
    			append_dev(p0, t1);
    			append_dev(div0, t2);
    			append_dev(div0, p1);
    			append_dev(p1, t3);
    			append_dev(p1, t4);
    			append_dev(div0, t5);
    			append_dev(div0, p2);
    			append_dev(p2, t6);
    			append_dev(p2, t7);
    			append_dev(main, t8);
    			append_dev(main, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			append_dev(main, t9);
    			append_dev(main, div2);
    			append_dev(main, t10);
    			append_dev(main, div3);

    			if (!mounted) {
    				dispose = [
    					listen_dev(main, "mousemove", /*movePaddle*/ ctx[3], false, false, false),
    					listen_dev(main, "click", /*initGame*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*game*/ 1 && t1_value !== (t1_value = /*game*/ ctx[0].level + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*game*/ 1 && t4_value !== (t4_value = /*game*/ ctx[0].lives + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*game*/ 1 && t7_value !== (t7_value = /*game*/ ctx[0].score + "")) set_data_dev(t7, t7_value);

    			if (dirty & /*game*/ 1) {
    				const old_length = each_value.length;
    				each_value = Array((/*game*/ ctx[0].level + 2) * 6);
    				validate_each_argument(each_value);
    				let i;

    				for (i = old_length; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (!each_blocks[i]) {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (i = each_value.length; i < old_length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*game*/ 1) {
    				set_style(div1, "grid-template-columns", "repeat(" + (/*game*/ ctx[0].level + 2) + ", 1fr)");
    			}

    			if (dirty & /*ball*/ 2) {
    				set_style(div2, "left", /*ball*/ ctx[1].x + "px");
    			}

    			if (dirty & /*ball*/ 2) {
    				set_style(div2, "bottom", /*ball*/ ctx[1].y + "px");
    			}

    			if (dirty & /*paddle*/ 4) {
    				set_style(div3, "left", /*paddle*/ ctx[2].x + "px");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(258:0) {#if !game.gameOver}",
    		ctx
    	});

    	return block;
    }

    // (268:6) {#each Array((game.level + 2) * 6) as _, i}
    function create_each_block(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "brick svelte-kmi3tl");
    			add_location(div, file, 268, 8, 6198);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(268:6) {#each Array((game.level + 2) * 6) as _, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (!/*game*/ ctx[0].gameOver) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);

    	let game = {
    		level: 1,
    		lives: 3,
    		score: 0,
    		speed: 20,
    		active: false,
    		gameOver: false
    	};

    	let ball = { x: 490, y: 32, width: 20, height: 20 };
    	let paddle = { x: 400 };

    	const movePaddle = e => {
    		if (e.layerX >= 100 && e.layerX <= 900) {
    			$$invalidate(2, paddle.x = e.layerX - 100, paddle);
    		}

    		if (!game.active) {
    			$$invalidate(1, ball.x = paddle.x + 90, ball);
    		}
    	};

    	const reset = () => {
    		$$invalidate(0, game.active = !game.active, game);
    		$$invalidate(1, ball.x = paddle.x + 90, ball);
    		$$invalidate(1, ball.y = 32, ball);
    	};

    	const isCollide = (a, b) => {
    		return !(a.y + a.height < b.y || a.y > b.y + b.height || a.x + a.width < b.x || a.x > b.x + b.width);
    	};

    	const bounceAngle = (a, b, c) => {
    		const l = b - a + 1;
    		const p = c * 100 / l;

    		return p <= 20
    		? -3
    		: p <= 40 ? -2 : p <= 60 ? 1 : p <= 80 ? 2 : 3;
    	};

    	const flashBricks = () => {
    		console.log(bricksArray);
    		let all = document.getElementsByClassName("brick");

    		bricksArray.forEach((el, index) => {
    			if (!el.destroyed) {
    				let times = 0;
    				all[index].style.backgroundColor = "tomato";

    				let interval = setInterval(
    					() => {
    						if (times % 2 === 0) {
    							all[index].style.backgroundColor = "rgb(60, 238, 43)";
    						} else {
    							all[index].style.backgroundColor = "tomato";
    						}

    						++times;

    						if (times === 5) {
    							clearInterval(interval);
    						}
    					},
    					100
    				);
    			}
    		});
    	};

    	const gameOver = (bX, bY, pX, interval) => {
    		if (bY < -20 && (bX < pX || bX > pX + 200)) {
    			if (game.lives > 0) {
    				$$invalidate(0, --game.lives, game);
    				clearInterval(interval);

    				setTimeout(
    					() => {
    						flashBricks();
    						reset();
    					},
    					0
    				);
    			} else {
    				clearInterval(interval);
    				$$invalidate(0, game.gameOver = true, game);
    			}
    		}
    	};

    	const playAgain = () => {
    		$$invalidate(0, game.gameOver = false, game);
    		$$invalidate(0, game.level = 1, game);
    		$$invalidate(0, game.lives = 3, game);
    		$$invalidate(0, game.score = 0, game);
    		$$invalidate(0, game.speed = 20, game);

    		setTimeout(
    			() => {
    				reset();
    				nextLevel();
    			},
    			0
    		);
    	};

    	let nextLevel = () => {
    		bricksArray = [];
    		let all = document.getElementsByClassName("brick");

    		setTimeout(
    			() => {
    				[...all].forEach((el, index) => {
    					all[index].style.backgroundColor = "rgb(60, 238, 43)";

    					bricksArray.push({
    						x: el.offsetLeft,
    						y: 580 - el.offsetTop,
    						height: el.clientHeight,
    						width: el.clientWidth,
    						destroyed: false
    					});
    				});
    			},
    			0
    		);
    	};

    	let bricksArray = [];

    	onMount(() => {
    		let all = document.getElementsByClassName("brick");

    		[...all].forEach(el => {
    			bricksArray.push({
    				x: el.offsetLeft,
    				y: 580 - el.offsetTop,
    				height: el.clientHeight,
    				width: el.clientWidth,
    				destroyed: false
    			});
    		});
    	});

    	const initGame = () => {
    		$$invalidate(0, game.active = !game.active, game);

    		if (game.active) {
    			let up = 8;
    			let right = 1;

    			const init = setInterval(
    				() => {
    					let leftBricks = 0;

    					bricksArray.forEach((el, index) => {
    						if (isCollide(ball, el) && !el.destroyed) {
    							const all = document.getElementsByClassName("brick");
    							all[index].style.backgroundColor = "transparent";
    							el.destroyed = true;
    							$$invalidate(0, ++game.score, game);
    							up = -up;
    						}

    						if (!el.destroyed) {
    							++leftBricks;
    						}

    						if (leftBricks === 0 && index + 1 === bricksArray.length) {
    							$$invalidate(0, ++game.level, game);

    							if (game.speed) {
    								$$invalidate(0, --game.speed, game);
    							}

    							setTimeout(
    								() => {
    									clearInterval(init);
    									reset();
    									nextLevel();
    								},
    								0
    							);
    						}
    					});

    					// bounce against the ceilings and floor
    					if (ball.y > 530 || ball.y < -50) {
    						up = -up;
    					}

    					// bounce against paddle
    					if (ball.y < 30 && ball.x + 20 > paddle.x && ball.x < paddle.x + 200) {
    						let res = bounceAngle(paddle.x, paddle.x + 200, ball.x + 10 - paddle.x);

    						if (res === 1) {
    							up = -up;
    							right = right / Math.abs(right);
    						} else {
    							up = -up;
    							right = 1 * res;
    						}
    					}

    					// bounce against side walls
    					if (ball.x > 980 || ball.x < 0) {
    						right = -right;
    					}

    					$$invalidate(1, ball.y += up, ball);
    					$$invalidate(1, ball.x += right, ball);
    					gameOver(ball.x, ball.y, paddle.x, init);
    				},
    				game.speed
    			);
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		game,
    		ball,
    		paddle,
    		movePaddle,
    		reset,
    		isCollide,
    		bounceAngle,
    		flashBricks,
    		gameOver,
    		playAgain,
    		nextLevel,
    		bricksArray,
    		initGame
    	});

    	$$self.$inject_state = $$props => {
    		if ("game" in $$props) $$invalidate(0, game = $$props.game);
    		if ("ball" in $$props) $$invalidate(1, ball = $$props.ball);
    		if ("paddle" in $$props) $$invalidate(2, paddle = $$props.paddle);
    		if ("nextLevel" in $$props) nextLevel = $$props.nextLevel;
    		if ("bricksArray" in $$props) bricksArray = $$props.bricksArray;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [game, ball, paddle, movePaddle, playAgain, initGame];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
