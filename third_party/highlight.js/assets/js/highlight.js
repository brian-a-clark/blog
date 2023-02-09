/*!
  Highlight.js v11.7.0 (git: 86dcb21022)
  (c) 2006-2023 undefined and other contributors
  License: BSD-3-Clause
 */
var hljs = (function () {
    'use strict';

    var deepFreezeEs6 = {exports: {}};

    function deepFreeze(obj) {
        if (obj instanceof Map) {
            obj.clear = obj.delete = obj.set = function () {
                throw new Error('map is read-only');
            };
        } else if (obj instanceof Set) {
            obj.add = obj.clear = obj.delete = function () {
                throw new Error('set is read-only');
            };
        }

        // Freeze self
        Object.freeze(obj);

        Object.getOwnPropertyNames(obj).forEach(function (name) {
            var prop = obj[name];

            // Freeze prop if it is an object
            if (typeof prop == 'object' && !Object.isFrozen(prop)) {
                deepFreeze(prop);
            }
        });

        return obj;
    }

    deepFreezeEs6.exports = deepFreeze;
    deepFreezeEs6.exports.default = deepFreeze;

    /** @typedef {import('highlight.js').CallbackResponse} CallbackResponse */
    /** @typedef {import('highlight.js').CompiledMode} CompiledMode */
    /** @implements CallbackResponse */

    class Response {
      /**
       * @param {CompiledMode} mode
       */
      constructor(mode) {
        // eslint-disable-next-line no-undefined
        if (mode.data === undefined) mode.data = {};

        this.data = mode.data;
        this.isMatchIgnored = false;
      }

      ignoreMatch() {
        this.isMatchIgnored = true;
      }
    }

    /**
     * @param {string} value
     * @returns {string}
     */
    function escapeHTML(value) {
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }

    /**
     * performs a shallow merge of multiple objects into one
     *
     * @template T
     * @param {T} original
     * @param {Record<string,any>[]} objects
     * @returns {T} a single new object
     */
    function inherit$1(original, ...objects) {
      /** @type Record<string,any> */
      const result = Object.create(null);

      for (const key in original) {
        result[key] = original[key];
      }
      objects.forEach(function(obj) {
        for (const key in obj) {
          result[key] = obj[key];
        }
      });
      return /** @type {T} */ (result);
    }

    /**
     * @typedef {object} Renderer
     * @property {(text: string) => void} addText
     * @property {(node: Node) => void} openNode
     * @property {(node: Node) => void} closeNode
     * @property {() => string} value
     */

    /** @typedef {{scope?: string, language?: string, sublanguage?: boolean}} Node */
    /** @typedef {{walk: (r: Renderer) => void}} Tree */
    /** */

    const SPAN_CLOSE = '</span>';

    /**
     * Determines if a node needs to be wrapped in <span>
     *
     * @param {Node} node */
    const emitsWrappingTags = (node) => {
      // rarely we can have a sublanguage where language is undefined
      // TODO: track down why
      return !!node.scope || (node.sublanguage && node.language);
    };

    /**
     *
     * @param {string} name
     * @param {{prefix:string}} options
     */
    const scopeToCSSClass = (name, { prefix }) => {
      if (name.includes(".")) {
        const pieces = name.split(".");
        return [
          `${prefix}${pieces.shift()}`,
          ...(pieces.map((x, i) => `${x}${"_".repeat(i + 1)}`))
        ].join(" ");
      }
      return `${prefix}${name}`;
    };

    /** @type {Renderer} */
    class HTMLRenderer {
      /**
       * Creates a new HTMLRenderer
       *
       * @param {Tree} parseTree - the parse tree (must support `walk` API)
       * @param {{classPrefix: string}} options
       */
      constructor(parseTree, options) {
        this.buffer = "";
        this.classPrefix = options.classPrefix;
        parseTree.walk(this);
      }

      /**
       * Adds texts to the output stream
       *
       * @param {string} text */
      addText(text) {
        this.buffer += escapeHTML(text);
      }

      /**
       * Adds a node open to the output stream (if needed)
       *
       * @param {Node} node */
      openNode(node) {
        if (!emitsWrappingTags(node)) return;

        let className = "";
        if (node.sublanguage) {
          className = `language-${node.language}`;
        } else {
          className = scopeToCSSClass(node.scope, { prefix: this.classPrefix });
        }
        this.span(className);
      }

      /**
       * Adds a node close to the output stream (if needed)
       *
       * @param {Node} node */
      closeNode(node) {
        if (!emitsWrappingTags(node)) return;

        this.buffer += SPAN_CLOSE;
      }

      /**
       * returns the accumulated buffer
      */
      value() {
        return this.buffer;
      }

      // helpers

      /**
       * Builds a span element
       *
       * @param {string} className */
      span(className) {
        this.buffer += `<span class="${className}">`;
      }
    }

    /** @typedef {{scope?: string, language?: string, sublanguage?: boolean, children: Node[]} | string} Node */
    /** @typedef {{scope?: string, language?: string, sublanguage?: boolean, children: Node[]} } DataNode */
    /** @typedef {import('highlight.js').Emitter} Emitter */
    /**  */

    /** @returns {DataNode} */
    const newNode = (opts = {}) => {
      /** @type DataNode */
      const result = { children: [] };
      Object.assign(result, opts);
      return result;
    };

    class TokenTree {
      constructor() {
        /** @type DataNode */
        this.rootNode = newNode();
        this.stack = [this.rootNode];
      }

      get top() {
        return this.stack[this.stack.length - 1];
      }

      get root() { return this.rootNode; }

      /** @param {Node} node */
      add(node) {
        this.top.children.push(node);
      }

      /** @param {string} scope */
      openNode(scope) {
        /** @type Node */
        const node = newNode({ scope });
        this.add(node);
        this.stack.push(node);
      }

      closeNode() {
        if (this.stack.length > 1) {
          return this.stack.pop();
        }
        // eslint-disable-next-line no-undefined
        return undefined;
      }

      closeAllNodes() {
        while (this.closeNode());
      }

      toJSON() {
        return JSON.stringify(this.rootNode, null, 4);
      }

      /**
       * @typedef { import("./html_renderer").Renderer } Renderer
       * @param {Renderer} builder
       */
      walk(builder) {
        // this does not
        return this.constructor._walk(builder, this.rootNode);
        // this works
        // return TokenTree._walk(builder, this.rootNode);
      }

      /**
       * @param {Renderer} builder
       * @param {Node} node
       */
      static _walk(builder, node) {
        if (typeof node === "string") {
          builder.addText(node);
        } else if (node.children) {
          builder.openNode(node);
          node.children.forEach((child) => this._walk(builder, child));
          builder.closeNode(node);
        }
        return builder;
      }

      /**
       * @param {Node} node
       */
      static _collapse(node) {
        if (typeof node === "string") return;
        if (!node.children) return;

        if (node.children.every(el => typeof el === "string")) {
          // node.text = node.children.join("");
          // delete node.children;
          node.children = [node.children.join("")];
        } else {
          node.children.forEach((child) => {
            TokenTree._collapse(child);
          });
        }
      }
    }

    /**
      Currently this is all private API, but this is the minimal API necessary
      that an Emitter must implement to fully support the parser.

      Minimal interface:

      - addKeyword(text, scope)
      - addText(text)
      - addSublanguage(emitter, subLanguageName)
      - finalize()
      - openNode(scope)
      - closeNode()
      - closeAllNodes()
      - toHTML()

    */

    /**
     * @implements {Emitter}
     */
    class TokenTreeEmitter extends TokenTree {
      /**
       * @param {*} options
       */
      constructor(options) {
        super();
        this.options = options;
      }

      /**
       * @param {string} text
       * @param {string} scope
       */
      addKeyword(text, scope) {
        if (text === "") { return; }

        this.openNode(scope);
        this.addText(text);
        this.closeNode();
      }

      /**
       * @param {string} text
       */
      addText(text) {
        if (text === "") { return; }

        this.add(text);
      }

      /**
       * @param {Emitter & {root: DataNode}} emitter
       * @param {string} name
       */
      addSublanguage(emitter, name) {
        /** @type DataNode */
        const node = emitter.root;
        node.sublanguage = true;
        node.language = name;
        this.add(node);
      }

      toHTML() {
        const renderer = new HTMLRenderer(this, this.options);
        return renderer.value();
      }

      finalize() {
        return true;
      }
    }

    /**
     * @param {string} value
     * @returns {RegExp}
     * */
    function escape$1(value) {
      return new RegExp(value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'm');
    }

    /**
     * @param {RegExp | string } re
     * @returns {string}
     */
    function source(re) {
      if (!re) return null;
      if (typeof re === "string") return re;

      return re.source;
    }

    /**
     * @param {RegExp | string } re
     * @returns {string}
     */
    function lookahead(re) {
      return concat('(?=', re, ')');
    }

    /**
     * @param {RegExp | string } re
     * @returns {string}
     */
    function anyNumberOfTimes(re) {
      return concat('(?:', re, ')*');
    }

    /**
     * @param {RegExp | string } re
     * @returns {string}
     */
    function optional(re) {
      return concat('(?:', re, ')?');
    }

    /**
     * @param {...(RegExp | string) } args
     * @returns {string}
     */
    function concat(...args) {
      const joined = args.map((x) => source(x)).join("");
      return joined;
    }

    /**
     * @param { Array<string | RegExp | Object> } args
     * @returns {object}
     */
    function stripOptionsFromArgs(args) {
      const opts = args[args.length - 1];

      if (typeof opts === 'object' && opts.constructor === Object) {
        args.splice(args.length - 1, 1);
        return opts;
      } else {
        return {};
      }
    }

    /** @typedef { {capture?: boolean} } RegexEitherOptions */

    /**
     * Any of the passed expresssions may match
     *
     * Creates a huge this | this | that | that match
     * @param {(RegExp | string)[] | [...(RegExp | string)[], RegexEitherOptions]} args
     * @returns {string}
     */
    function either(...args) {
      /** @type { object & {capture?: boolean} }  */
      const opts = stripOptionsFromArgs(args);
      const joined = '('
        + (opts.capture ? "" : "?:")
        + args.map((x) => source(x)).join("|") + ")";
      return joined;
    }

    /**
     * @param {RegExp | string} re
     * @returns {number}
     */
    function countMatchGroups(re) {
      return (new RegExp(re.toString() + '|')).exec('').length - 1;
    }

    /**
     * Does lexeme start with a regular expression match at the beginning
     * @param {RegExp} re
     * @param {string} lexeme
     */
    function startsWith(re, lexeme) {
      const match = re && re.exec(lexeme);
      return match && match.index === 0;
    }

    // BACKREF_RE matches an open parenthesis or backreference. To avoid
    // an incorrect parse, it additionally matches the following:
    // - [...] elements, where the meaning of parentheses and escapes change
    // - other escape sequences, so we do not misparse escape sequences as
    //   interesting elements
    // - non-matching or lookahead parentheses, which do not capture. These
    //   follow the '(' with a '?'.
    const BACKREF_RE = /\[(?:[^\\\]]|\\.)*\]|\(\??|\\([1-9][0-9]*)|\\./;

    // **INTERNAL** Not intended for outside usage
    // join logically computes regexps.join(separator), but fixes the
    // backreferences so they continue to match.
    // it also places each individual regular expression into it's own
    // match group, keeping track of the sequencing of those match groups
    // is currently an exercise for the caller. :-)
    /**
     * @param {(string | RegExp)[]} regexps
     * @param {{joinWith: string}} opts
     * @returns {string}
     */
    function _rewriteBackreferences(regexps, { joinWith }) {
      let numCaptures = 0;

      return regexps.map((regex) => {
        numCaptures += 1;
        const offset = numCaptures;
        let re = source(regex);
        let out = '';

        while (re.length > 0) {
          const match = BACKREF_RE.exec(re);
          if (!match) {
            out += re;
            break;
          }
          out += re.substring(0, match.index);
          re = re.substring(match.index + match[0].length);
          if (match[0][0] === '\\' && match[1]) {
            // Adjust the backreference.
            out += '\\' + String(Number(match[1]) + offset);
          } else {
            out += match[0];
            if (match[0] === '(') {
              numCaptures++;
            }
          }
        }
        return out;
      }).map(re => `(${re})`).join(joinWith);
    }

    /** @typedef {import('highlight.js').Mode} Mode */
    /** @typedef {import('highlight.js').ModeCallback} ModeCallback */

    // Common regexps
    const MATCH_NOTHING_RE = /\b\B/;
    const IDENT_RE$1 = '[a-zA-Z]\\w*';
    const UNDERSCORE_IDENT_RE = '[a-zA-Z_]\\w*';
    const NUMBER_RE = '\\b\\d+(\\.\\d+)?';
    const C_NUMBER_RE = '(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)'; // 0x..., 0..., decimal, float
    const BINARY_NUMBER_RE = '\\b(0b[01]+)'; // 0b...
    const RE_STARTERS_RE = '!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~';

    /**
    * @param { Partial<Mode> & {binary?: string | RegExp} } opts
    */
    const SHEBANG = (opts = {}) => {
      const beginShebang = /^#![ ]*\//;
      if (opts.binary) {
        opts.begin = concat(
          beginShebang,
          /.*\b/,
          opts.binary,
          /\b.*/);
      }
      return inherit$1({
        scope: 'meta',
        begin: beginShebang,
        end: /$/,
        relevance: 0,
        /** @type {ModeCallback} */
        "on:begin": (m, resp) => {
          if (m.index !== 0) resp.ignoreMatch();
        }
      }, opts);
    };

    // Common modes
    const BACKSLASH_ESCAPE = {
      begin: '\\\\[\\s\\S]', relevance: 0
    };
    const APOS_STRING_MODE = {
      scope: 'string',
      begin: '\'',
      end: '\'',
      illegal: '\\n',
      contains: [BACKSLASH_ESCAPE]
    };
    const QUOTE_STRING_MODE = {
      scope: 'string',
      begin: '"',
      end: '"',
      illegal: '\\n',
      contains: [BACKSLASH_ESCAPE]
    };
    const PHRASAL_WORDS_MODE = {
      begin: /\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/
    };
    /**
     * Creates a comment mode
     *
     * @param {string | RegExp} begin
     * @param {string | RegExp} end
     * @param {Mode | {}} [modeOptions]
     * @returns {Partial<Mode>}
     */
    const COMMENT = function(begin, end, modeOptions = {}) {
      const mode = inherit$1(
        {
          scope: 'comment',
          begin,
          end,
          contains: []
        },
        modeOptions
      );
      mode.contains.push({
        scope: 'doctag',
        // hack to avoid the space from being included. the space is necessary to
        // match here to prevent the plain text rule below from gobbling up doctags
        begin: '[ ]*(?=(TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):)',
        end: /(TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):/,
        excludeBegin: true,
        relevance: 0
      });
      const ENGLISH_WORD = either(
        // list of common 1 and 2 letter words in English
        "I",
        "a",
        "is",
        "so",
        "us",
        "to",
        "at",
        "if",
        "in",
        "it",
        "on",
        // note: this is not an exhaustive list of contractions, just popular ones
        /[A-Za-z]+['](d|ve|re|ll|t|s|n)/, // contractions - can't we'd they're let's, etc
        /[A-Za-z]+[-][a-z]+/, // `no-way`, etc.
        /[A-Za-z][a-z]{2,}/ // allow capitalized words at beginning of sentences
      );
      // looking like plain text, more likely to be a comment
      mode.contains.push(
        {
          // TODO: how to include ", (, ) without breaking grammars that use these for
          // comment delimiters?
          // begin: /[ ]+([()"]?([A-Za-z'-]{3,}|is|a|I|so|us|[tT][oO]|at|if|in|it|on)[.]?[()":]?([.][ ]|[ ]|\))){3}/
          // ---

          // this tries to find sequences of 3 english words in a row (without any
          // "programming" type syntax) this gives us a strong signal that we've
          // TRULY found a comment - vs perhaps scanning with the wrong language.
          // It's possible to find something that LOOKS like the start of the
          // comment - but then if there is no readable text - good chance it is a
          // false match and not a comment.
          //
          // for a visual example please see:
          // https://github.com/highlightjs/highlight.js/issues/2827

          begin: concat(
            /[ ]+/, // necessary to prevent us gobbling up doctags like /* @author Bob Mcgill */
            '(',
            ENGLISH_WORD,
            /[.]?[:]?([.][ ]|[ ])/,
            '){3}') // look for 3 words in a row
        }
      );
      return mode;
    };
    const C_LINE_COMMENT_MODE = COMMENT('//', '$');
    const C_BLOCK_COMMENT_MODE = COMMENT('/\\*', '\\*/');
    const HASH_COMMENT_MODE = COMMENT('#', '$');
    const NUMBER_MODE = {
      scope: 'number',
      begin: NUMBER_RE,
      relevance: 0
    };
    const C_NUMBER_MODE = {
      scope: 'number',
      begin: C_NUMBER_RE,
      relevance: 0
    };
    const BINARY_NUMBER_MODE = {
      scope: 'number',
      begin: BINARY_NUMBER_RE,
      relevance: 0
    };
    const REGEXP_MODE = {
      // this outer rule makes sure we actually have a WHOLE regex and not simply
      // an expression such as:
      //
      //     3 / something
      //
      // (which will then blow up when regex's `illegal` sees the newline)
      begin: /(?=\/[^/\n]*\/)/,
      contains: [{
        scope: 'regexp',
        begin: /\//,
        end: /\/[gimuy]*/,
        illegal: /\n/,
        contains: [
          BACKSLASH_ESCAPE,
          {
            begin: /\[/,
            end: /\]/,
            relevance: 0,
            contains: [BACKSLASH_ESCAPE]
          }
        ]
      }]
    };
    const TITLE_MODE = {
      scope: 'title',
      begin: IDENT_RE$1,
      relevance: 0
    };
    const UNDERSCORE_TITLE_MODE = {
      scope: 'title',
      begin: UNDERSCORE_IDENT_RE,
      relevance: 0
    };
    const METHOD_GUARD = {
      // excludes method names from keyword processing
      begin: '\\.\\s*' + UNDERSCORE_IDENT_RE,
      relevance: 0
    };

    /**
     * Adds end same as begin mechanics to a mode
     *
     * Your mode must include at least a single () match group as that first match
     * group is what is used for comparison
     * @param {Partial<Mode>} mode
     */
    const END_SAME_AS_BEGIN = function(mode) {
      return Object.assign(mode,
        {
          /** @type {ModeCallback} */
          'on:begin': (m, resp) => { resp.data._beginMatch = m[1]; },
          /** @type {ModeCallback} */
          'on:end': (m, resp) => { if (resp.data._beginMatch !== m[1]) resp.ignoreMatch(); }
        });
    };

    var MODES$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        MATCH_NOTHING_RE: MATCH_NOTHING_RE,
        IDENT_RE: IDENT_RE$1,
        UNDERSCORE_IDENT_RE: UNDERSCORE_IDENT_RE,
        NUMBER_RE: NUMBER_RE,
        C_NUMBER_RE: C_NUMBER_RE,
        BINARY_NUMBER_RE: BINARY_NUMBER_RE,
        RE_STARTERS_RE: RE_STARTERS_RE,
        SHEBANG: SHEBANG,
        BACKSLASH_ESCAPE: BACKSLASH_ESCAPE,
        APOS_STRING_MODE: APOS_STRING_MODE,
        QUOTE_STRING_MODE: QUOTE_STRING_MODE,
        PHRASAL_WORDS_MODE: PHRASAL_WORDS_MODE,
        COMMENT: COMMENT,
        C_LINE_COMMENT_MODE: C_LINE_COMMENT_MODE,
        C_BLOCK_COMMENT_MODE: C_BLOCK_COMMENT_MODE,
        HASH_COMMENT_MODE: HASH_COMMENT_MODE,
        NUMBER_MODE: NUMBER_MODE,
        C_NUMBER_MODE: C_NUMBER_MODE,
        BINARY_NUMBER_MODE: BINARY_NUMBER_MODE,
        REGEXP_MODE: REGEXP_MODE,
        TITLE_MODE: TITLE_MODE,
        UNDERSCORE_TITLE_MODE: UNDERSCORE_TITLE_MODE,
        METHOD_GUARD: METHOD_GUARD,
        END_SAME_AS_BEGIN: END_SAME_AS_BEGIN
    });

    /**
    @typedef {import('highlight.js').CallbackResponse} CallbackResponse
    @typedef {import('highlight.js').CompilerExt} CompilerExt
    */

    // Grammar extensions / plugins
    // See: https://github.com/highlightjs/highlight.js/issues/2833

    // Grammar extensions allow "syntactic sugar" to be added to the grammar modes
    // without requiring any underlying changes to the compiler internals.

    // `compileMatch` being the perfect small example of now allowing a grammar
    // author to write `match` when they desire to match a single expression rather
    // than being forced to use `begin`.  The extension then just moves `match` into
    // `begin` when it runs.  Ie, no features have been added, but we've just made
    // the experience of writing (and reading grammars) a little bit nicer.

    // ------

    // TODO: We need negative look-behind support to do this properly
    /**
     * Skip a match if it has a preceding dot
     *
     * This is used for `beginKeywords` to prevent matching expressions such as
     * `bob.keyword.do()`. The mode compiler automatically wires this up as a
     * special _internal_ 'on:begin' callback for modes with `beginKeywords`
     * @param {RegExpMatchArray} match
     * @param {CallbackResponse} response
     */
    function skipIfHasPrecedingDot(match, response) {
      const before = match.input[match.index - 1];
      if (before === ".") {
        response.ignoreMatch();
      }
    }

    /**
     *
     * @type {CompilerExt}
     */
    function scopeClassName(mode, _parent) {
      // eslint-disable-next-line no-undefined
      if (mode.className !== undefined) {
        mode.scope = mode.className;
        delete mode.className;
      }
    }

    /**
     * `beginKeywords` syntactic sugar
     * @type {CompilerExt}
     */
    function beginKeywords(mode, parent) {
      if (!parent) return;
      if (!mode.beginKeywords) return;

      // for languages with keywords that include non-word characters checking for
      // a word boundary is not sufficient, so instead we check for a word boundary
      // or whitespace - this does no harm in any case since our keyword engine
      // doesn't allow spaces in keywords anyways and we still check for the boundary
      // first
      mode.begin = '\\b(' + mode.beginKeywords.split(' ').join('|') + ')(?!\\.)(?=\\b|\\s)';
      mode.__beforeBegin = skipIfHasPrecedingDot;
      mode.keywords = mode.keywords || mode.beginKeywords;
      delete mode.beginKeywords;

      // prevents double relevance, the keywords themselves provide
      // relevance, the mode doesn't need to double it
      // eslint-disable-next-line no-undefined
      if (mode.relevance === undefined) mode.relevance = 0;
    }

    /**
     * Allow `illegal` to contain an array of illegal values
     * @type {CompilerExt}
     */
    function compileIllegal(mode, _parent) {
      if (!Array.isArray(mode.illegal)) return;

      mode.illegal = either(...mode.illegal);
    }

    /**
     * `match` to match a single expression for readability
     * @type {CompilerExt}
     */
    function compileMatch(mode, _parent) {
      if (!mode.match) return;
      if (mode.begin || mode.end) throw new Error("begin & end are not supported with match");

      mode.begin = mode.match;
      delete mode.match;
    }

    /**
     * provides the default 1 relevance to all modes
     * @type {CompilerExt}
     */
    function compileRelevance(mode, _parent) {
      // eslint-disable-next-line no-undefined
      if (mode.relevance === undefined) mode.relevance = 1;
    }

    // allow beforeMatch to act as a "qualifier" for the match
    // the full match begin must be [beforeMatch][begin]
    const beforeMatchExt = (mode, parent) => {
      if (!mode.beforeMatch) return;
      // starts conflicts with endsParent which we need to make sure the child
      // rule is not matched multiple times
      if (mode.starts) throw new Error("beforeMatch cannot be used with starts");

      const originalMode = Object.assign({}, mode);
      Object.keys(mode).forEach((key) => { delete mode[key]; });

      mode.keywords = originalMode.keywords;
      mode.begin = concat(originalMode.beforeMatch, lookahead(originalMode.begin));
      mode.starts = {
        relevance: 0,
        contains: [
          Object.assign(originalMode, { endsParent: true })
        ]
      };
      mode.relevance = 0;

      delete originalMode.beforeMatch;
    };

    // keywords that should have no default relevance value
    const COMMON_KEYWORDS = [
      'of',
      'and',
      'for',
      'in',
      'not',
      'or',
      'if',
      'then',
      'parent', // common variable name
      'list', // common variable name
      'value' // common variable name
    ];

    const DEFAULT_KEYWORD_SCOPE = "keyword";

    /**
     * Given raw keywords from a language definition, compile them.
     *
     * @param {string | Record<string,string|string[]> | Array<string>} rawKeywords
     * @param {boolean} caseInsensitive
     */
    function compileKeywords(rawKeywords, caseInsensitive, scopeName = DEFAULT_KEYWORD_SCOPE) {
      /** @type {import("highlight.js/private").KeywordDict} */
      const compiledKeywords = Object.create(null);

      // input can be a string of keywords, an array of keywords, or a object with
      // named keys representing scopeName (which can then point to a string or array)
      if (typeof rawKeywords === 'string') {
        compileList(scopeName, rawKeywords.split(" "));
      } else if (Array.isArray(rawKeywords)) {
        compileList(scopeName, rawKeywords);
      } else {
        Object.keys(rawKeywords).forEach(function(scopeName) {
          // collapse all our objects back into the parent object
          Object.assign(
            compiledKeywords,
            compileKeywords(rawKeywords[scopeName], caseInsensitive, scopeName)
          );
        });
      }
      return compiledKeywords;

      // ---

      /**
       * Compiles an individual list of keywords
       *
       * Ex: "for if when while|5"
       *
       * @param {string} scopeName
       * @param {Array<string>} keywordList
       */
      function compileList(scopeName, keywordList) {
        if (caseInsensitive) {
          keywordList = keywordList.map(x => x.toLowerCase());
        }
        keywordList.forEach(function(keyword) {
          const pair = keyword.split('|');
          compiledKeywords[pair[0]] = [scopeName, scoreForKeyword(pair[0], pair[1])];
        });
      }
    }

    /**
     * Returns the proper score for a given keyword
     *
     * Also takes into account comment keywords, which will be scored 0 UNLESS
     * another score has been manually assigned.
     * @param {string} keyword
     * @param {string} [providedScore]
     */
    function scoreForKeyword(keyword, providedScore) {
      // manual scores always win over common keywords
      // so you can force a score of 1 if you really insist
      if (providedScore) {
        return Number(providedScore);
      }

      return commonKeyword(keyword) ? 0 : 1;
    }

    /**
     * Determines if a given keyword is common or not
     *
     * @param {string} keyword */
    function commonKeyword(keyword) {
      return COMMON_KEYWORDS.includes(keyword.toLowerCase());
    }

    /*

    For the reasoning behind this please see:
    https://github.com/highlightjs/highlight.js/issues/2880#issuecomment-747275419

    */

    /**
     * @type {Record<string, boolean>}
     */
    const seenDeprecations = {};

    /**
     * @param {string} message
     */
    const error = (message) => {
      console.error(message);
    };

    /**
     * @param {string} message
     * @param {any} args
     */
    const warn = (message, ...args) => {
      console.log(`WARN: ${message}`, ...args);
    };

    /**
     * @param {string} version
     * @param {string} message
     */
    const deprecated = (version, message) => {
      if (seenDeprecations[`${version}/${message}`]) return;

      console.log(`Deprecated as of ${version}. ${message}`);
      seenDeprecations[`${version}/${message}`] = true;
    };

    /* eslint-disable no-throw-literal */

    /**
    @typedef {import('highlight.js').CompiledMode} CompiledMode
    */

    const MultiClassError = new Error();

    /**
     * Renumbers labeled scope names to account for additional inner match
     * groups that otherwise would break everything.
     *
     * Lets say we 3 match scopes:
     *
     *   { 1 => ..., 2 => ..., 3 => ... }
     *
     * So what we need is a clean match like this:
     *
     *   (a)(b)(c) => [ "a", "b", "c" ]
     *
     * But this falls apart with inner match groups:
     *
     * (a)(((b)))(c) => ["a", "b", "b", "b", "c" ]
     *
     * Our scopes are now "out of alignment" and we're repeating `b` 3 times.
     * What needs to happen is the numbers are remapped:
     *
     *   { 1 => ..., 2 => ..., 5 => ... }
     *
     * We also need to know that the ONLY groups that should be output
     * are 1, 2, and 5.  This function handles this behavior.
     *
     * @param {CompiledMode} mode
     * @param {Array<RegExp | string>} regexes
     * @param {{key: "beginScope"|"endScope"}} opts
     */
    function remapScopeNames(mode, regexes, { key }) {
      let offset = 0;
      const scopeNames = mode[key];
      /** @type Record<number,boolean> */
      const emit = {};
      /** @type Record<number,string> */
      const positions = {};

      for (let i = 1; i <= regexes.length; i++) {
        positions[i + offset] = scopeNames[i];
        emit[i + offset] = true;
        offset += countMatchGroups(regexes[i - 1]);
      }
      // we use _emit to keep track of which match groups are "top-level" to avoid double
      // output from inside match groups
      mode[key] = positions;
      mode[key]._emit = emit;
      mode[key]._multi = true;
    }

    /**
     * @param {CompiledMode} mode
     */
    function beginMultiClass(mode) {
      if (!Array.isArray(mode.begin)) return;

      if (mode.skip || mode.excludeBegin || mode.returnBegin) {
        error("skip, excludeBegin, returnBegin not compatible with beginScope: {}");
        throw MultiClassError;
      }

      if (typeof mode.beginScope !== "object" || mode.beginScope === null) {
        error("beginScope must be object");
        throw MultiClassError;
      }

      remapScopeNames(mode, mode.begin, { key: "beginScope" });
      mode.begin = _rewriteBackreferences(mode.begin, { joinWith: "" });
    }

    /**
     * @param {CompiledMode} mode
     */
    function endMultiClass(mode) {
      if (!Array.isArray(mode.end)) return;

      if (mode.skip || mode.excludeEnd || mode.returnEnd) {
        error("skip, excludeEnd, returnEnd not compatible with endScope: {}");
        throw MultiClassError;
      }

      if (typeof mode.endScope !== "object" || mode.endScope === null) {
        error("endScope must be object");
        throw MultiClassError;
      }

      remapScopeNames(mode, mode.end, { key: "endScope" });
      mode.end = _rewriteBackreferences(mode.end, { joinWith: "" });
    }

    /**
     * this exists only to allow `scope: {}` to be used beside `match:`
     * Otherwise `beginScope` would necessary and that would look weird

      {
        match: [ /def/, /\w+/ ]
        scope: { 1: "keyword" , 2: "title" }
      }

     * @param {CompiledMode} mode
     */
    function scopeSugar(mode) {
      if (mode.scope && typeof mode.scope === "object" && mode.scope !== null) {
        mode.beginScope = mode.scope;
        delete mode.scope;
      }
    }

    /**
     * @param {CompiledMode} mode
     */
    function MultiClass(mode) {
      scopeSugar(mode);

      if (typeof mode.beginScope === "string") {
        mode.beginScope = { _wrap: mode.beginScope };
      }
      if (typeof mode.endScope === "string") {
        mode.endScope = { _wrap: mode.endScope };
      }

      beginMultiClass(mode);
      endMultiClass(mode);
    }

    /**
    @typedef {import('highlight.js').Mode} Mode
    @typedef {import('highlight.js').CompiledMode} CompiledMode
    @typedef {import('highlight.js').Language} Language
    @typedef {import('highlight.js').HLJSPlugin} HLJSPlugin
    @typedef {import('highlight.js').CompiledLanguage} CompiledLanguage
    */

    // compilation

    /**
     * Compiles a language definition result
     *
     * Given the raw result of a language definition (Language), compiles this so
     * that it is ready for highlighting code.
     * @param {Language} language
     * @returns {CompiledLanguage}
     */
    function compileLanguage(language) {
      /**
       * Builds a regex with the case sensitivity of the current language
       *
       * @param {RegExp | string} value
       * @param {boolean} [global]
       */
      function langRe(value, global) {
        return new RegExp(
          source(value),
          'm'
          + (language.case_insensitive ? 'i' : '')
          + (language.unicodeRegex ? 'u' : '')
          + (global ? 'g' : '')
        );
      }

      /**
        Stores multiple regular expressions and allows you to quickly search for
        them all in a string simultaneously - returning the first match.  It does
        this by creating a huge (a|b|c) regex - each individual item wrapped with ()
        and joined by `|` - using match groups to track position.  When a match is
        found checking which position in the array has content allows us to figure
        out which of the original regexes / match groups triggered the match.

        The match object itself (the result of `Regex.exec`) is returned but also
        enhanced by merging in any meta-data that was registered with the regex.
        This is how we keep track of which mode matched, and what type of rule
        (`illegal`, `begin`, end, etc).
      */
      class MultiRegex {
        constructor() {
          this.matchIndexes = {};
          // @ts-ignore
          this.regexes = [];
          this.matchAt = 1;
          this.position = 0;
        }

        // @ts-ignore
        addRule(re, opts) {
          opts.position = this.position++;
          // @ts-ignore
          this.matchIndexes[this.matchAt] = opts;
          this.regexes.push([opts, re]);
          this.matchAt += countMatchGroups(re) + 1;
        }

        compile() {
          if (this.regexes.length === 0) {
            // avoids the need to check length every time exec is called
            // @ts-ignore
            this.exec = () => null;
          }
          const terminators = this.regexes.map(el => el[1]);
          this.matcherRe = langRe(_rewriteBackreferences(terminators, { joinWith: '|' }), true);
          this.lastIndex = 0;
        }

        /** @param {string} s */
        exec(s) {
          this.matcherRe.lastIndex = this.lastIndex;
          const match = this.matcherRe.exec(s);
          if (!match) { return null; }

          // eslint-disable-next-line no-undefined
          const i = match.findIndex((el, i) => i > 0 && el !== undefined);
          // @ts-ignore
          const matchData = this.matchIndexes[i];
          // trim off any earlier non-relevant match groups (ie, the other regex
          // match groups that make up the multi-matcher)
          match.splice(0, i);

          return Object.assign(match, matchData);
        }
      }

      /*
        Created to solve the key deficiently with MultiRegex - there is no way to
        test for multiple matches at a single location.  Why would we need to do
        that?  In the future a more dynamic engine will allow certain matches to be
        ignored.  An example: if we matched say the 3rd regex in a large group but
        decided to ignore it - we'd need to started testing again at the 4th
        regex... but MultiRegex itself gives us no real way to do that.

        So what this class creates MultiRegexs on the fly for whatever search
        position they are needed.

        NOTE: These additional MultiRegex objects are created dynamically.  For most
        grammars most of the time we will never actually need anything more than the
        first MultiRegex - so this shouldn't have too much overhead.

        Say this is our search group, and we match regex3, but wish to ignore it.

          regex1 | regex2 | regex3 | regex4 | regex5    ' ie, startAt = 0

        What we need is a new MultiRegex that only includes the remaining
        possibilities:

          regex4 | regex5                               ' ie, startAt = 3

        This class wraps all that complexity up in a simple API... `startAt` decides
        where in the array of expressions to start doing the matching. It
        auto-increments, so if a match is found at position 2, then startAt will be
        set to 3.  If the end is reached startAt will return to 0.

        MOST of the time the parser will be setting startAt manually to 0.
      */
      class ResumableMultiRegex {
        constructor() {
          // @ts-ignore
          this.rules = [];
          // @ts-ignore
          this.multiRegexes = [];
          this.count = 0;

          this.lastIndex = 0;
          this.regexIndex = 0;
        }

        // @ts-ignore
        getMatcher(index) {
          if (this.multiRegexes[index]) return this.multiRegexes[index];

          const matcher = new MultiRegex();
          this.rules.slice(index).forEach(([re, opts]) => matcher.addRule(re, opts));
          matcher.compile();
          this.multiRegexes[index] = matcher;
          return matcher;
        }

        resumingScanAtSamePosition() {
          return this.regexIndex !== 0;
        }

        considerAll() {
          this.regexIndex = 0;
        }

        // @ts-ignore
        addRule(re, opts) {
          this.rules.push([re, opts]);
          if (opts.type === "begin") this.count++;
        }

        /** @param {string} s */
        exec(s) {
          const m = this.getMatcher(this.regexIndex);
          m.lastIndex = this.lastIndex;
          let result = m.exec(s);

          // The following is because we have no easy way to say "resume scanning at the
          // existing position but also skip the current rule ONLY". What happens is
          // all prior rules are also skipped which can result in matching the wrong
          // thing. Example of matching "booger":

          // our matcher is [string, "booger", number]
          //
          // ....booger....

          // if "booger" is ignored then we'd really need a regex to scan from the
          // SAME position for only: [string, number] but ignoring "booger" (if it
          // was the first match), a simple resume would scan ahead who knows how
          // far looking only for "number", ignoring potential string matches (or
          // future "booger" matches that might be valid.)

          // So what we do: We execute two matchers, one resuming at the same
          // position, but the second full matcher starting at the position after:

          //     /--- resume first regex match here (for [number])
          //     |/---- full match here for [string, "booger", number]
          //     vv
          // ....booger....

          // Which ever results in a match first is then used. So this 3-4 step
          // process essentially allows us to say "match at this position, excluding
          // a prior rule that was ignored".
          //
          // 1. Match "booger" first, ignore. Also proves that [string] does non match.
          // 2. Resume matching for [number]
          // 3. Match at index + 1 for [string, "booger", number]
          // 4. If #2 and #3 result in matches, which came first?
          if (this.resumingScanAtSamePosition()) {
            if (result && result.index === this.lastIndex) ; else { // use the second matcher result
              const m2 = this.getMatcher(0);
              m2.lastIndex = this.lastIndex + 1;
              result = m2.exec(s);
            }
          }

          if (result) {
            this.regexIndex += result.position + 1;
            if (this.regexIndex === this.count) {
              // wrap-around to considering all matches again
              this.considerAll();
            }
          }

          return result;
        }
      }

      /**
       * Given a mode, builds a huge ResumableMultiRegex that can be used to walk
       * the content and find matches.
       *
       * @param {CompiledMode} mode
       * @returns {ResumableMultiRegex}
       */
      function buildModeRegex(mode) {
        const mm = new ResumableMultiRegex();

        mode.contains.forEach(term => mm.addRule(term.begin, { rule: term, type: "begin" }));

        if (mode.terminatorEnd) {
          mm.addRule(mode.terminatorEnd, { type: "end" });
        }
        if (mode.illegal) {
          mm.addRule(mode.illegal, { type: "illegal" });
        }

        return mm;
      }

      /** skip vs abort vs ignore
       *
       * @skip   - The mode is still entered and exited normally (and contains rules apply),
       *           but all content is held and added to the parent buffer rather than being
       *           output when the mode ends.  Mostly used with `sublanguage` to build up
       *           a single large buffer than can be parsed by sublanguage.
       *
       *             - The mode begin ands ends normally.
       *             - Content matched is added to the parent mode buffer.
       *             - The parser cursor is moved forward normally.
       *
       * @abort  - A hack placeholder until we have ignore.  Aborts the mode (as if it
       *           never matched) but DOES NOT continue to match subsequent `contains`
       *           modes.  Abort is bad/suboptimal because it can result in modes
       *           farther down not getting applied because an earlier rule eats the
       *           content but then aborts.
       *
       *             - The mode does not begin.
       *             - Content matched by `begin` is added to the mode buffer.
       *             - The parser cursor is moved forward accordingly.
       *
       * @ignore - Ignores the mode (as if it never matched) and continues to match any
       *           subsequent `contains` modes.  Ignore isn't technically possible with
       *           the current parser implementation.
       *
       *             - The mode does not begin.
       *             - Content matched by `begin` is ignored.
       *             - The parser cursor is not moved forward.
       */

      /**
       * Compiles an individual mode
       *
       * This can raise an error if the mode contains certain detectable known logic
       * issues.
       * @param {Mode} mode
       * @param {CompiledMode | null} [parent]
       * @returns {CompiledMode | never}
       */
      function compileMode(mode, parent) {
        const cmode = /** @type CompiledMode */ (mode);
        if (mode.isCompiled) return cmode;

        [
          scopeClassName,
          // do this early so compiler extensions generally don't have to worry about
          // the distinction between match/begin
          compileMatch,
          MultiClass,
          beforeMatchExt
        ].forEach(ext => ext(mode, parent));

        language.compilerExtensions.forEach(ext => ext(mode, parent));

        // __beforeBegin is considered private API, internal use only
        mode.__beforeBegin = null;

        [
          beginKeywords,
          // do this later so compiler extensions that come earlier have access to the
          // raw array if they wanted to perhaps manipulate it, etc.
          compileIllegal,
          // default to 1 relevance if not specified
          compileRelevance
        ].forEach(ext => ext(mode, parent));

        mode.isCompiled = true;

        let keywordPattern = null;
        if (typeof mode.keywords === "object" && mode.keywords.$pattern) {
          // we need a copy because keywords might be compiled multiple times
          // so we can't go deleting $pattern from the original on the first
          // pass
          mode.keywords = Object.assign({}, mode.keywords);
          keywordPattern = mode.keywords.$pattern;
          delete mode.keywords.$pattern;
        }
        keywordPattern = keywordPattern || /\w+/;

        if (mode.keywords) {
          mode.keywords = compileKeywords(mode.keywords, language.case_insensitive);
        }

        cmode.keywordPatternRe = langRe(keywordPattern, true);

        if (parent) {
          if (!mode.begin) mode.begin = /\B|\b/;
          cmode.beginRe = langRe(cmode.begin);
          if (!mode.end && !mode.endsWithParent) mode.end = /\B|\b/;
          if (mode.end) cmode.endRe = langRe(cmode.end);
          cmode.terminatorEnd = source(cmode.end) || '';
          if (mode.endsWithParent && parent.terminatorEnd) {
            cmode.terminatorEnd += (mode.end ? '|' : '') + parent.terminatorEnd;
          }
        }
        if (mode.illegal) cmode.illegalRe = langRe(/** @type {RegExp | string} */ (mode.illegal));
        if (!mode.contains) mode.contains = [];

        mode.contains = [].concat(...mode.contains.map(function(c) {
          return expandOrCloneMode(c === 'self' ? mode : c);
        }));
        mode.contains.forEach(function(c) { compileMode(/** @type Mode */ (c), cmode); });

        if (mode.starts) {
          compileMode(mode.starts, parent);
        }

        cmode.matcher = buildModeRegex(cmode);
        return cmode;
      }

      if (!language.compilerExtensions) language.compilerExtensions = [];

      // self is not valid at the top-level
      if (language.contains && language.contains.includes('self')) {
        throw new Error("ERR: contains `self` is not supported at the top-level of a language.  See documentation.");
      }

      // we need a null object, which inherit will guarantee
      language.classNameAliases = inherit$1(language.classNameAliases || {});

      return compileMode(/** @type Mode */ (language));
    }

    /**
     * Determines if a mode has a dependency on it's parent or not
     *
     * If a mode does have a parent dependency then often we need to clone it if
     * it's used in multiple places so that each copy points to the correct parent,
     * where-as modes without a parent can often safely be re-used at the bottom of
     * a mode chain.
     *
     * @param {Mode | null} mode
     * @returns {boolean} - is there a dependency on the parent?
     * */
    function dependencyOnParent(mode) {
      if (!mode) return false;

      return mode.endsWithParent || dependencyOnParent(mode.starts);
    }

    /**
     * Expands a mode or clones it if necessary
     *
     * This is necessary for modes with parental dependenceis (see notes on
     * `dependencyOnParent`) and for nodes that have `variants` - which must then be
     * exploded into their own individual modes at compile time.
     *
     * @param {Mode} mode
     * @returns {Mode | Mode[]}
     * */
    function expandOrCloneMode(mode) {
      if (mode.variants && !mode.cachedVariants) {
        mode.cachedVariants = mode.variants.map(function(variant) {
          return inherit$1(mode, { variants: null }, variant);
        });
      }

      // EXPAND
      // if we have variants then essentially "replace" the mode with the variants
      // this happens in compileMode, where this function is called from
      if (mode.cachedVariants) {
        return mode.cachedVariants;
      }

      // CLONE
      // if we have dependencies on parents then we need a unique
      // instance of ourselves, so we can be reused with many
      // different parents without issue
      if (dependencyOnParent(mode)) {
        return inherit$1(mode, { starts: mode.starts ? inherit$1(mode.starts) : null });
      }

      if (Object.isFrozen(mode)) {
        return inherit$1(mode);
      }

      // no special dependency issues, just return ourselves
      return mode;
    }

    var version = "11.7.0";

    class HTMLInjectionError extends Error {
      constructor(reason, html) {
        super(reason);
        this.name = "HTMLInjectionError";
        this.html = html;
      }
    }

    /*
    Syntax highlighting with language autodetection.
    https://highlightjs.org/
    */

    /**
    @typedef {import('highlight.js').Mode} Mode
    @typedef {import('highlight.js').CompiledMode} CompiledMode
    @typedef {import('highlight.js').CompiledScope} CompiledScope
    @typedef {import('highlight.js').Language} Language
    @typedef {import('highlight.js').HLJSApi} HLJSApi
    @typedef {import('highlight.js').HLJSPlugin} HLJSPlugin
    @typedef {import('highlight.js').PluginEvent} PluginEvent
    @typedef {import('highlight.js').HLJSOptions} HLJSOptions
    @typedef {import('highlight.js').LanguageFn} LanguageFn
    @typedef {import('highlight.js').HighlightedHTMLElement} HighlightedHTMLElement
    @typedef {import('highlight.js').BeforeHighlightContext} BeforeHighlightContext
    @typedef {import('highlight.js/private').MatchType} MatchType
    @typedef {import('highlight.js/private').KeywordData} KeywordData
    @typedef {import('highlight.js/private').EnhancedMatch} EnhancedMatch
    @typedef {import('highlight.js/private').AnnotatedError} AnnotatedError
    @typedef {import('highlight.js').AutoHighlightResult} AutoHighlightResult
    @typedef {import('highlight.js').HighlightOptions} HighlightOptions
    @typedef {import('highlight.js').HighlightResult} HighlightResult
    */


    const escape = escapeHTML;
    const inherit = inherit$1;
    const NO_MATCH = Symbol("nomatch");
    const MAX_KEYWORD_HITS = 7;

    /**
     * @param {any} hljs - object that is extended (legacy)
     * @returns {HLJSApi}
     */
    const HLJS = function(hljs) {
      // Global internal variables used within the highlight.js library.
      /** @type {Record<string, Language>} */
      const languages = Object.create(null);
      /** @type {Record<string, string>} */
      const aliases = Object.create(null);
      /** @type {HLJSPlugin[]} */
      const plugins = [];

      // safe/production mode - swallows more errors, tries to keep running
      // even if a single syntax or parse hits a fatal error
      let SAFE_MODE = true;
      const LANGUAGE_NOT_FOUND = "Could not find the language '{}', did you forget to load/include a language module?";
      /** @type {Language} */
      const PLAINTEXT_LANGUAGE = { disableAutodetect: true, name: 'Plain text', contains: [] };

      // Global options used when within external APIs. This is modified when
      // calling the `hljs.configure` function.
      /** @type HLJSOptions */
      let options = {
        ignoreUnescapedHTML: false,
        throwUnescapedHTML: false,
        noHighlightRe: /^(no-?highlight)$/i,
        languageDetectRe: /\blang(?:uage)?-([\w-]+)\b/i,
        classPrefix: 'hljs-',
        cssSelector: 'pre code',
        languages: null,
        // beta configuration options, subject to change, welcome to discuss
        // https://github.com/highlightjs/highlight.js/issues/1086
        __emitter: TokenTreeEmitter
      };

      /* Utility functions */

      /**
       * Tests a language name to see if highlighting should be skipped
       * @param {string} languageName
       */
      function shouldNotHighlight(languageName) {
        return options.noHighlightRe.test(languageName);
      }

      /**
       * @param {HighlightedHTMLElement} block - the HTML element to determine language for
       */
      function blockLanguage(block) {
        let classes = block.className + ' ';

        classes += block.parentNode ? block.parentNode.className : '';

        // language-* takes precedence over non-prefixed class names.
        const match = options.languageDetectRe.exec(classes);
        if (match) {
          const language = getLanguage(match[1]);
          if (!language) {
            warn(LANGUAGE_NOT_FOUND.replace("{}", match[1]));
            warn("Falling back to no-highlight mode for this block.", block);
          }
          return language ? match[1] : 'no-highlight';
        }

        return classes
          .split(/\s+/)
          .find((_class) => shouldNotHighlight(_class) || getLanguage(_class));
      }

      /**
       * Core highlighting function.
       *
       * OLD API
       * highlight(lang, code, ignoreIllegals, continuation)
       *
       * NEW API
       * highlight(code, {lang, ignoreIllegals})
       *
       * @param {string} codeOrLanguageName - the language to use for highlighting
       * @param {string | HighlightOptions} optionsOrCode - the code to highlight
       * @param {boolean} [ignoreIllegals] - whether to ignore illegal matches, default is to bail
       *
       * @returns {HighlightResult} Result - an object that represents the result
       * @property {string} language - the language name
       * @property {number} relevance - the relevance score
       * @property {string} value - the highlighted HTML code
       * @property {string} code - the original raw code
       * @property {CompiledMode} top - top of the current mode stack
       * @property {boolean} illegal - indicates whether any illegal matches were found
      */
      function highlight(codeOrLanguageName, optionsOrCode, ignoreIllegals) {
        let code = "";
        let languageName = "";
        if (typeof optionsOrCode === "object") {
          code = codeOrLanguageName;
          ignoreIllegals = optionsOrCode.ignoreIllegals;
          languageName = optionsOrCode.language;
        } else {
          // old API
          deprecated("10.7.0", "highlight(lang, code, ...args) has been deprecated.");
          deprecated("10.7.0", "Please use highlight(code, options) instead.\nhttps://github.com/highlightjs/highlight.js/issues/2277");
          languageName = codeOrLanguageName;
          code = optionsOrCode;
        }

        // https://github.com/highlightjs/highlight.js/issues/3149
        // eslint-disable-next-line no-undefined
        if (ignoreIllegals === undefined) { ignoreIllegals = true; }

        /** @type {BeforeHighlightContext} */
        const context = {
          code,
          language: languageName
        };
        // the plugin can change the desired language or the code to be highlighted
        // just be changing the object it was passed
        fire("before:highlight", context);

        // a before plugin can usurp the result completely by providing it's own
        // in which case we don't even need to call highlight
        const result = context.result
          ? context.result
          : _highlight(context.language, context.code, ignoreIllegals);

        result.code = context.code;
        // the plugin can change anything in result to suite it
        fire("after:highlight", result);

        return result;
      }

      /**
       * private highlight that's used internally and does not fire callbacks
       *
       * @param {string} languageName - the language to use for highlighting
       * @param {string} codeToHighlight - the code to highlight
       * @param {boolean?} [ignoreIllegals] - whether to ignore illegal matches, default is to bail
       * @param {CompiledMode?} [continuation] - current continuation mode, if any
       * @returns {HighlightResult} - result of the highlight operation
      */
      function _highlight(languageName, codeToHighlight, ignoreIllegals, continuation) {
        const keywordHits = Object.create(null);

        /**
         * Return keyword data if a match is a keyword
         * @param {CompiledMode} mode - current mode
         * @param {string} matchText - the textual match
         * @returns {KeywordData | false}
         */
        function keywordData(mode, matchText) {
          return mode.keywords[matchText];
        }

        function processKeywords() {
          if (!top.keywords) {
            emitter.addText(modeBuffer);
            return;
          }

          let lastIndex = 0;
          top.keywordPatternRe.lastIndex = 0;
          let match = top.keywordPatternRe.exec(modeBuffer);
          let buf = "";

          while (match) {
            buf += modeBuffer.substring(lastIndex, match.index);
            const word = language.case_insensitive ? match[0].toLowerCase() : match[0];
            const data = keywordData(top, word);
            if (data) {
              const [kind, keywordRelevance] = data;
              emitter.addText(buf);
              buf = "";

              keywordHits[word] = (keywordHits[word] || 0) + 1;
              if (keywordHits[word] <= MAX_KEYWORD_HITS) relevance += keywordRelevance;
              if (kind.startsWith("_")) {
                // _ implied for relevance only, do not highlight
                // by applying a class name
                buf += match[0];
              } else {
                const cssClass = language.classNameAliases[kind] || kind;
                emitter.addKeyword(match[0], cssClass);
              }
            } else {
              buf += match[0];
            }
            lastIndex = top.keywordPatternRe.lastIndex;
            match = top.keywordPatternRe.exec(modeBuffer);
          }
          buf += modeBuffer.substring(lastIndex);
          emitter.addText(buf);
        }

        function processSubLanguage() {
          if (modeBuffer === "") return;
          /** @type HighlightResult */
          let result = null;

          if (typeof top.subLanguage === 'string') {
            if (!languages[top.subLanguage]) {
              emitter.addText(modeBuffer);
              return;
            }
            result = _highlight(top.subLanguage, modeBuffer, true, continuations[top.subLanguage]);
            continuations[top.subLanguage] = /** @type {CompiledMode} */ (result._top);
          } else {
            result = highlightAuto(modeBuffer, top.subLanguage.length ? top.subLanguage : null);
          }

          // Counting embedded language score towards the host language may be disabled
          // with zeroing the containing mode relevance. Use case in point is Markdown that
          // allows XML everywhere and makes every XML snippet to have a much larger Markdown
          // score.
          if (top.relevance > 0) {
            relevance += result.relevance;
          }
          emitter.addSublanguage(result._emitter, result.language);
        }

        function processBuffer() {
          if (top.subLanguage != null) {
            processSubLanguage();
          } else {
            processKeywords();
          }
          modeBuffer = '';
        }

        /**
         * @param {CompiledScope} scope
         * @param {RegExpMatchArray} match
         */
        function emitMultiClass(scope, match) {
          let i = 1;
          const max = match.length - 1;
          while (i <= max) {
            if (!scope._emit[i]) { i++; continue; }
            const klass = language.classNameAliases[scope[i]] || scope[i];
            const text = match[i];
            if (klass) {
              emitter.addKeyword(text, klass);
            } else {
              modeBuffer = text;
              processKeywords();
              modeBuffer = "";
            }
            i++;
          }
        }

        /**
         * @param {CompiledMode} mode - new mode to start
         * @param {RegExpMatchArray} match
         */
        function startNewMode(mode, match) {
          if (mode.scope && typeof mode.scope === "string") {
            emitter.openNode(language.classNameAliases[mode.scope] || mode.scope);
          }
          if (mode.beginScope) {
            // beginScope just wraps the begin match itself in a scope
            if (mode.beginScope._wrap) {
              emitter.addKeyword(modeBuffer, language.classNameAliases[mode.beginScope._wrap] || mode.beginScope._wrap);
              modeBuffer = "";
            } else if (mode.beginScope._multi) {
              // at this point modeBuffer should just be the match
              emitMultiClass(mode.beginScope, match);
              modeBuffer = "";
            }
          }

          top = Object.create(mode, { parent: { value: top } });
          return top;
        }

        /**
         * @param {CompiledMode } mode - the mode to potentially end
         * @param {RegExpMatchArray} match - the latest match
         * @param {string} matchPlusRemainder - match plus remainder of content
         * @returns {CompiledMode | void} - the next mode, or if void continue on in current mode
         */
        function endOfMode(mode, match, matchPlusRemainder) {
          let matched = startsWith(mode.endRe, matchPlusRemainder);

          if (matched) {
            if (mode["on:end"]) {
              const resp = new Response(mode);
              mode["on:end"](match, resp);
              if (resp.isMatchIgnored) matched = false;
            }

            if (matched) {
              while (mode.endsParent && mode.parent) {
                mode = mode.parent;
              }
              return mode;
            }
          }
          // even if on:end fires an `ignore` it's still possible
          // that we might trigger the end node because of a parent mode
          if (mode.endsWithParent) {
            return endOfMode(mode.parent, match, matchPlusRemainder);
          }
        }

        /**
         * Handle matching but then ignoring a sequence of text
         *
         * @param {string} lexeme - string containing full match text
         */
        function doIgnore(lexeme) {
          if (top.matcher.regexIndex === 0) {
            // no more regexes to potentially match here, so we move the cursor forward one
            // space
            modeBuffer += lexeme[0];
            return 1;
          } else {
            // no need to move the cursor, we still have additional regexes to try and
            // match at this very spot
            resumeScanAtSamePosition = true;
            return 0;
          }
        }

        /**
         * Handle the start of a new potential mode match
         *
         * @param {EnhancedMatch} match - the current match
         * @returns {number} how far to advance the parse cursor
         */
        function doBeginMatch(match) {
          const lexeme = match[0];
          const newMode = match.rule;

          const resp = new Response(newMode);
          // first internal before callbacks, then the public ones
          const beforeCallbacks = [newMode.__beforeBegin, newMode["on:begin"]];
          for (const cb of beforeCallbacks) {
            if (!cb) continue;
            cb(match, resp);
            if (resp.isMatchIgnored) return doIgnore(lexeme);
          }

          if (newMode.skip) {
            modeBuffer += lexeme;
          } else {
            if (newMode.excludeBegin) {
              modeBuffer += lexeme;
            }
            processBuffer();
            if (!newMode.returnBegin && !newMode.excludeBegin) {
              modeBuffer = lexeme;
            }
          }
          startNewMode(newMode, match);
          return newMode.returnBegin ? 0 : lexeme.length;
        }

        /**
         * Handle the potential end of mode
         *
         * @param {RegExpMatchArray} match - the current match
         */
        function doEndMatch(match) {
          const lexeme = match[0];
          const matchPlusRemainder = codeToHighlight.substring(match.index);

          const endMode = endOfMode(top, match, matchPlusRemainder);
          if (!endMode) { return NO_MATCH; }

          const origin = top;
          if (top.endScope && top.endScope._wrap) {
            processBuffer();
            emitter.addKeyword(lexeme, top.endScope._wrap);
          } else if (top.endScope && top.endScope._multi) {
            processBuffer();
            emitMultiClass(top.endScope, match);
          } else if (origin.skip) {
            modeBuffer += lexeme;
          } else {
            if (!(origin.returnEnd || origin.excludeEnd)) {
              modeBuffer += lexeme;
            }
            processBuffer();
            if (origin.excludeEnd) {
              modeBuffer = lexeme;
            }
          }
          do {
            if (top.scope) {
              emitter.closeNode();
            }
            if (!top.skip && !top.subLanguage) {
              relevance += top.relevance;
            }
            top = top.parent;
          } while (top !== endMode.parent);
          if (endMode.starts) {
            startNewMode(endMode.starts, match);
          }
          return origin.returnEnd ? 0 : lexeme.length;
        }

        function processContinuations() {
          const list = [];
          for (let current = top; current !== language; current = current.parent) {
            if (current.scope) {
              list.unshift(current.scope);
            }
          }
          list.forEach(item => emitter.openNode(item));
        }

        /** @type {{type?: MatchType, index?: number, rule?: Mode}}} */
        let lastMatch = {};

        /**
         *  Process an individual match
         *
         * @param {string} textBeforeMatch - text preceding the match (since the last match)
         * @param {EnhancedMatch} [match] - the match itself
         */
        function processLexeme(textBeforeMatch, match) {
          const lexeme = match && match[0];

          // add non-matched text to the current mode buffer
          modeBuffer += textBeforeMatch;

          if (lexeme == null) {
            processBuffer();
            return 0;
          }

          // we've found a 0 width match and we're stuck, so we need to advance
          // this happens when we have badly behaved rules that have optional matchers to the degree that
          // sometimes they can end up matching nothing at all
          // Ref: https://github.com/highlightjs/highlight.js/issues/2140
          if (lastMatch.type === "begin" && match.type === "end" && lastMatch.index === match.index && lexeme === "") {
            // spit the "skipped" character that our regex choked on back into the output sequence
            modeBuffer += codeToHighlight.slice(match.index, match.index + 1);
            if (!SAFE_MODE) {
              /** @type {AnnotatedError} */
              const err = new Error(`0 width match regex (${languageName})`);
              err.languageName = languageName;
              err.badRule = lastMatch.rule;
              throw err;
            }
            return 1;
          }
          lastMatch = match;

          if (match.type === "begin") {
            return doBeginMatch(match);
          } else if (match.type === "illegal" && !ignoreIllegals) {
            // illegal match, we do not continue processing
            /** @type {AnnotatedError} */
            const err = new Error('Illegal lexeme "' + lexeme + '" for mode "' + (top.scope || '<unnamed>') + '"');
            err.mode = top;
            throw err;
          } else if (match.type === "end") {
            const processed = doEndMatch(match);
            if (processed !== NO_MATCH) {
              return processed;
            }
          }

          // edge case for when illegal matches $ (end of line) which is technically
          // a 0 width match but not a begin/end match so it's not caught by the
          // first handler (when ignoreIllegals is true)
          if (match.type === "illegal" && lexeme === "") {
            // advance so we aren't stuck in an infinite loop
            return 1;
          }

          // infinite loops are BAD, this is a last ditch catch all. if we have a
          // decent number of iterations yet our index (cursor position in our
          // parsing) still 3x behind our index then something is very wrong
          // so we bail
          if (iterations > 100000 && iterations > match.index * 3) {
            const err = new Error('potential infinite loop, way more iterations than matches');
            throw err;
          }

          /*
          Why might be find ourselves here?  An potential end match that was
          triggered but could not be completed.  IE, `doEndMatch` returned NO_MATCH.
          (this could be because a callback requests the match be ignored, etc)

          This causes no real harm other than stopping a few times too many.
          */

          modeBuffer += lexeme;
          return lexeme.length;
        }

        const language = getLanguage(languageName);
        if (!language) {
          error(LANGUAGE_NOT_FOUND.replace("{}", languageName));
          throw new Error('Unknown language: "' + languageName + '"');
        }

        const md = compileLanguage(language);
        let result = '';
        /** @type {CompiledMode} */
        let top = continuation || md;
        /** @type Record<string,CompiledMode> */
        const continuations = {}; // keep continuations for sub-languages
        const emitter = new options.__emitter(options);
        processContinuations();
        let modeBuffer = '';
        let relevance = 0;
        let index = 0;
        let iterations = 0;
        let resumeScanAtSamePosition = false;

        try {
          top.matcher.considerAll();

          for (;;) {
            iterations++;
            if (resumeScanAtSamePosition) {
              // only regexes not matched previously will now be
              // considered for a potential match
              resumeScanAtSamePosition = false;
            } else {
              top.matcher.considerAll();
            }
            top.matcher.lastIndex = index;

            const match = top.matcher.exec(codeToHighlight);
            // console.log("match", match[0], match.rule && match.rule.begin)

            if (!match) break;

            const beforeMatch = codeToHighlight.substring(index, match.index);
            const processedCount = processLexeme(beforeMatch, match);
            index = match.index + processedCount;
          }
          processLexeme(codeToHighlight.substring(index));
          emitter.closeAllNodes();
          emitter.finalize();
          result = emitter.toHTML();

          return {
            language: languageName,
            value: result,
            relevance: relevance,
            illegal: false,
            _emitter: emitter,
            _top: top
          };
        } catch (err) {
          if (err.message && err.message.includes('Illegal')) {
            return {
              language: languageName,
              value: escape(codeToHighlight),
              illegal: true,
              relevance: 0,
              _illegalBy: {
                message: err.message,
                index: index,
                context: codeToHighlight.slice(index - 100, index + 100),
                mode: err.mode,
                resultSoFar: result
              },
              _emitter: emitter
            };
          } else if (SAFE_MODE) {
            return {
              language: languageName,
              value: escape(codeToHighlight),
              illegal: false,
              relevance: 0,
              errorRaised: err,
              _emitter: emitter,
              _top: top
            };
          } else {
            throw err;
          }
        }
      }

      /**
       * returns a valid highlight result, without actually doing any actual work,
       * auto highlight starts with this and it's possible for small snippets that
       * auto-detection may not find a better match
       * @param {string} code
       * @returns {HighlightResult}
       */
      function justTextHighlightResult(code) {
        const result = {
          value: escape(code),
          illegal: false,
          relevance: 0,
          _top: PLAINTEXT_LANGUAGE,
          _emitter: new options.__emitter(options)
        };
        result._emitter.addText(code);
        return result;
      }

      /**
      Highlighting with language detection. Accepts a string with the code to
      highlight. Returns an object with the following properties:

      - language (detected language)
      - relevance (int)
      - value (an HTML string with highlighting markup)
      - secondBest (object with the same structure for second-best heuristically
        detected language, may be absent)

        @param {string} code
        @param {Array<string>} [languageSubset]
        @returns {AutoHighlightResult}
      */
      function highlightAuto(code, languageSubset) {
        languageSubset = languageSubset || options.languages || Object.keys(languages);
        const plaintext = justTextHighlightResult(code);

        const results = languageSubset.filter(getLanguage).filter(autoDetection).map(name =>
          _highlight(name, code, false)
        );
        results.unshift(plaintext); // plaintext is always an option

        const sorted = results.sort((a, b) => {
          // sort base on relevance
          if (a.relevance !== b.relevance) return b.relevance - a.relevance;

          // always award the tie to the base language
          // ie if C++ and Arduino are tied, it's more likely to be C++
          if (a.language && b.language) {
            if (getLanguage(a.language).supersetOf === b.language) {
              return 1;
            } else if (getLanguage(b.language).supersetOf === a.language) {
              return -1;
            }
          }

          // otherwise say they are equal, which has the effect of sorting on
          // relevance while preserving the original ordering - which is how ties
          // have historically been settled, ie the language that comes first always
          // wins in the case of a tie
          return 0;
        });

        const [best, secondBest] = sorted;

        /** @type {AutoHighlightResult} */
        const result = best;
        result.secondBest = secondBest;

        return result;
      }

      /**
       * Builds new class name for block given the language name
       *
       * @param {HTMLElement} element
       * @param {string} [currentLang]
       * @param {string} [resultLang]
       */
      function updateClassName(element, currentLang, resultLang) {
        const language = (currentLang && aliases[currentLang]) || resultLang;

        element.classList.add("hljs");
        element.classList.add(`language-${language}`);
      }

      /**
       * Applies highlighting to a DOM node containing code.
       *
       * @param {HighlightedHTMLElement} element - the HTML element to highlight
      */
      function highlightElement(element) {
        /** @type HTMLElement */
        let node = null;
        const language = blockLanguage(element);

        if (shouldNotHighlight(language)) return;

        fire("before:highlightElement",
          { el: element, language: language });

        // we should be all text, no child nodes (unescaped HTML) - this is possibly
        // an HTML injection attack - it's likely too late if this is already in
        // production (the code has likely already done its damage by the time
        // we're seeing it)... but we yell loudly about this so that hopefully it's
        // more likely to be caught in development before making it to production
        if (element.children.length > 0) {
          if (!options.ignoreUnescapedHTML) {
            console.warn("One of your code blocks includes unescaped HTML. This is a potentially serious security risk.");
            console.warn("https://github.com/highlightjs/highlight.js/wiki/security");
            console.warn("The element with unescaped HTML:");
            console.warn(element);
          }
          if (options.throwUnescapedHTML) {
            const err = new HTMLInjectionError(
              "One of your code blocks includes unescaped HTML.",
              element.innerHTML
            );
            throw err;
          }
        }

        node = element;
        const text = node.textContent;
        const result = language ? highlight(text, { language, ignoreIllegals: true }) : highlightAuto(text);

        element.innerHTML = result.value;
        updateClassName(element, language, result.language);
        element.result = {
          language: result.language,
          // TODO: remove with version 11.0
          re: result.relevance,
          relevance: result.relevance
        };
        if (result.secondBest) {
          element.secondBest = {
            language: result.secondBest.language,
            relevance: result.secondBest.relevance
          };
        }

        fire("after:highlightElement", { el: element, result, text });
      }

      /**
       * Updates highlight.js global options with the passed options
       *
       * @param {Partial<HLJSOptions>} userOptions
       */
      function configure(userOptions) {
        options = inherit(options, userOptions);
      }

      // TODO: remove v12, deprecated
      const initHighlighting = () => {
        highlightAll();
        deprecated("10.6.0", "initHighlighting() deprecated.  Use highlightAll() now.");
      };

      // TODO: remove v12, deprecated
      function initHighlightingOnLoad() {
        highlightAll();
        deprecated("10.6.0", "initHighlightingOnLoad() deprecated.  Use highlightAll() now.");
      }

      let wantsHighlight = false;

      /**
       * auto-highlights all pre>code elements on the page
       */
      function highlightAll() {
        // if we are called too early in the loading process
        if (document.readyState === "loading") {
          wantsHighlight = true;
          return;
        }

        const blocks = document.querySelectorAll(options.cssSelector);
        blocks.forEach(highlightElement);
      }

      function boot() {
        // if a highlight was requested before DOM was loaded, do now
        if (wantsHighlight) highlightAll();
      }

      // make sure we are in the browser environment
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('DOMContentLoaded', boot, false);
      }

      /**
       * Register a language grammar module
       *
       * @param {string} languageName
       * @param {LanguageFn} languageDefinition
       */
      function registerLanguage(languageName, languageDefinition) {
        let lang = null;
        try {
          lang = languageDefinition(hljs);
        } catch (error$1) {
          error("Language definition for '{}' could not be registered.".replace("{}", languageName));
          // hard or soft error
          if (!SAFE_MODE) { throw error$1; } else { error(error$1); }
          // languages that have serious errors are replaced with essentially a
          // "plaintext" stand-in so that the code blocks will still get normal
          // css classes applied to them - and one bad language won't break the
          // entire highlighter
          lang = PLAINTEXT_LANGUAGE;
        }
        // give it a temporary name if it doesn't have one in the meta-data
        if (!lang.name) lang.name = languageName;
        languages[languageName] = lang;
        lang.rawDefinition = languageDefinition.bind(null, hljs);

        if (lang.aliases) {
          registerAliases(lang.aliases, { languageName });
        }
      }

      /**
       * Remove a language grammar module
       *
       * @param {string} languageName
       */
      function unregisterLanguage(languageName) {
        delete languages[languageName];
        for (const alias of Object.keys(aliases)) {
          if (aliases[alias] === languageName) {
            delete aliases[alias];
          }
        }
      }

      /**
       * @returns {string[]} List of language internal names
       */
      function listLanguages() {
        return Object.keys(languages);
      }

      /**
       * @param {string} name - name of the language to retrieve
       * @returns {Language | undefined}
       */
      function getLanguage(name) {
        name = (name || '').toLowerCase();
        return languages[name] || languages[aliases[name]];
      }

      /**
       *
       * @param {string|string[]} aliasList - single alias or list of aliases
       * @param {{languageName: string}} opts
       */
      function registerAliases(aliasList, { languageName }) {
        if (typeof aliasList === 'string') {
          aliasList = [aliasList];
        }
        aliasList.forEach(alias => { aliases[alias.toLowerCase()] = languageName; });
      }

      /**
       * Determines if a given language has auto-detection enabled
       * @param {string} name - name of the language
       */
      function autoDetection(name) {
        const lang = getLanguage(name);
        return lang && !lang.disableAutodetect;
      }

      /**
       * Upgrades the old highlightBlock plugins to the new
       * highlightElement API
       * @param {HLJSPlugin} plugin
       */
      function upgradePluginAPI(plugin) {
        // TODO: remove with v12
        if (plugin["before:highlightBlock"] && !plugin["before:highlightElement"]) {
          plugin["before:highlightElement"] = (data) => {
            plugin["before:highlightBlock"](
              Object.assign({ block: data.el }, data)
            );
          };
        }
        if (plugin["after:highlightBlock"] && !plugin["after:highlightElement"]) {
          plugin["after:highlightElement"] = (data) => {
            plugin["after:highlightBlock"](
              Object.assign({ block: data.el }, data)
            );
          };
        }
      }

      /**
       * @param {HLJSPlugin} plugin
       */
      function addPlugin(plugin) {
        upgradePluginAPI(plugin);
        plugins.push(plugin);
      }

      /**
       *
       * @param {PluginEvent} event
       * @param {any} args
       */
      function fire(event, args) {
        const cb = event;
        plugins.forEach(function(plugin) {
          if (plugin[cb]) {
            plugin[cb](args);
          }
        });
      }

      /**
       * DEPRECATED
       * @param {HighlightedHTMLElement} el
       */
      function deprecateHighlightBlock(el) {
        deprecated("10.7.0", "highlightBlock will be removed entirely in v12.0");
        deprecated("10.7.0", "Please use highlightElement now.");

        return highlightElement(el);
      }

      /* Interface definition */
      Object.assign(hljs, {
        highlight,
        highlightAuto,
        highlightAll,
        highlightElement,
        // TODO: Remove with v12 API
        highlightBlock: deprecateHighlightBlock,
        configure,
        initHighlighting,
        initHighlightingOnLoad,
        registerLanguage,
        unregisterLanguage,
        listLanguages,
        getLanguage,
        registerAliases,
        autoDetection,
        inherit,
        addPlugin
      });

      hljs.debugMode = function() { SAFE_MODE = false; };
      hljs.safeMode = function() { SAFE_MODE = true; };
      hljs.versionString = version;

      hljs.regex = {
        concat: concat,
        lookahead: lookahead,
        either: either,
        optional: optional,
        anyNumberOfTimes: anyNumberOfTimes
      };

      for (const key in MODES$1) {
        // @ts-ignore
        if (typeof MODES$1[key] === "object") {
          // @ts-ignore
          deepFreezeEs6.exports(MODES$1[key]);
        }
      }

      // merge all the modes/regexes into our main object
      Object.assign(hljs, MODES$1);

      return hljs;
    };

    // export an "instance" of the highlighter
    var HighlightJS = HLJS({});

    /*
    Language: Augmented Backus-Naur Form
    Author: Alex McKibben <alex@nullscope.net>
    Website: https://tools.ietf.org/html/rfc5234
    Audit: 2020
    */

    /** @type LanguageFn */
    function abnf(hljs) {
      const regex = hljs.regex;
      const IDENT = /^[a-zA-Z][a-zA-Z0-9-]*/;

      const KEYWORDS = [
        "ALPHA",
        "BIT",
        "CHAR",
        "CR",
        "CRLF",
        "CTL",
        "DIGIT",
        "DQUOTE",
        "HEXDIG",
        "HTAB",
        "LF",
        "LWSP",
        "OCTET",
        "SP",
        "VCHAR",
        "WSP"
      ];

      const COMMENT = hljs.COMMENT(/;/, /$/);

      const TERMINAL_BINARY = {
        scope: "symbol",
        match: /%b[0-1]+(-[0-1]+|(\.[0-1]+)+)?/
      };

      const TERMINAL_DECIMAL = {
        scope: "symbol",
        match: /%d[0-9]+(-[0-9]+|(\.[0-9]+)+)?/
      };

      const TERMINAL_HEXADECIMAL = {
        scope: "symbol",
        match: /%x[0-9A-F]+(-[0-9A-F]+|(\.[0-9A-F]+)+)?/
      };

      const CASE_SENSITIVITY = {
        scope: "symbol",
        match: /%[si](?=".*")/
      };

      const RULE_DECLARATION = {
        scope: "attribute",
        match: regex.concat(IDENT, /(?=\s*=)/)
      };

      const ASSIGNMENT = {
        scope: "operator",
        match: /=\/?/
      };

      return {
        name: 'Augmented Backus-Naur Form',
        illegal: /[!@#$^&',?+~`|:]/,
        keywords: KEYWORDS,
        contains: [
          ASSIGNMENT,
          RULE_DECLARATION,
          COMMENT,
          TERMINAL_BINARY,
          TERMINAL_DECIMAL,
          TERMINAL_HEXADECIMAL,
          CASE_SENSITIVITY,
          hljs.QUOTE_STRING_MODE,
          hljs.NUMBER_MODE
        ]
      };
    }

    /*
     Language: Apache Access Log
     Author: Oleg Efimov <efimovov@gmail.com>
     Description: Apache/Nginx Access Logs
     Website: https://httpd.apache.org/docs/2.4/logs.html#accesslog
     Category: web, logs
     Audit: 2020
     */

    /** @type LanguageFn */
    function accesslog(hljs) {
      const regex = hljs.regex;
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods
      const HTTP_VERBS = [
        "GET",
        "POST",
        "HEAD",
        "PUT",
        "DELETE",
        "CONNECT",
        "OPTIONS",
        "PATCH",
        "TRACE"
      ];
      return {
        name: 'Apache Access Log',
        contains: [
          // IP
          {
            className: 'number',
            begin: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d{1,5})?\b/,
            relevance: 5
          },
          // Other numbers
          {
            className: 'number',
            begin: /\b\d+\b/,
            relevance: 0
          },
          // Requests
          {
            className: 'string',
            begin: regex.concat(/"/, regex.either(...HTTP_VERBS)),
            end: /"/,
            keywords: HTTP_VERBS,
            illegal: /\n/,
            relevance: 5,
            contains: [
              {
                begin: /HTTP\/[12]\.\d'/,
                relevance: 5
              }
            ]
          },
          // Dates
          {
            className: 'string',
            // dates must have a certain length, this prevents matching
            // simple array accesses a[123] and [] and other common patterns
            // found in other languages
            begin: /\[\d[^\]\n]{8,}\]/,
            illegal: /\n/,
            relevance: 1
          },
          {
            className: 'string',
            begin: /\[/,
            end: /\]/,
            illegal: /\n/,
            relevance: 0
          },
          // User agent / relevance boost
          {
            className: 'string',
            begin: /"Mozilla\/\d\.\d \(/,
            end: /"/,
            illegal: /\n/,
            relevance: 3
          },
          // Strings
          {
            className: 'string',
            begin: /"/,
            end: /"/,
            illegal: /\n/,
            relevance: 0
          }
        ]
      };
    }

    /*
    Language: Ada
    Author: Lars Schulna <kartoffelbrei.mit.muskatnuss@gmail.org>
    Description: Ada is a general-purpose programming language that has great support for saftey critical and real-time applications.
                 It has been developed by the DoD and thus has been used in military and safety-critical applications (like civil aviation).
                 The first version appeared in the 80s, but it's still actively developed today with
                 the newest standard being Ada2012.
    */

    // We try to support full Ada2012
    //
    // We highlight all appearances of types, keywords, literals (string, char, number, bool)
    // and titles (user defined function/procedure/package)
    // CSS classes are set accordingly
    //
    // Languages causing problems for language detection:
    // xml (broken by Foo : Bar type), elm (broken by Foo : Bar type), vbscript-html (broken by body keyword)
    // sql (ada default.txt has a lot of sql keywords)

    /** @type LanguageFn */
    function ada(hljs) {
      // Regular expression for Ada numeric literals.
      // stolen form the VHDL highlighter

      // Decimal literal:
      const INTEGER_RE = '\\d(_|\\d)*';
      const EXPONENT_RE = '[eE][-+]?' + INTEGER_RE;
      const DECIMAL_LITERAL_RE = INTEGER_RE + '(\\.' + INTEGER_RE + ')?' + '(' + EXPONENT_RE + ')?';

      // Based literal:
      const BASED_INTEGER_RE = '\\w+';
      const BASED_LITERAL_RE = INTEGER_RE + '#' + BASED_INTEGER_RE + '(\\.' + BASED_INTEGER_RE + ')?' + '#' + '(' + EXPONENT_RE + ')?';

      const NUMBER_RE = '\\b(' + BASED_LITERAL_RE + '|' + DECIMAL_LITERAL_RE + ')';

      // Identifier regex
      const ID_REGEX = '[A-Za-z](_?[A-Za-z0-9.])*';

      // bad chars, only allowed in literals
      const BAD_CHARS = `[]\\{\\}%#'"`;

      // Ada doesn't have block comments, only line comments
      const COMMENTS = hljs.COMMENT('--', '$');

      // variable declarations of the form
      // Foo : Bar := Baz;
      // where only Bar will be highlighted
      const VAR_DECLS = {
        // TODO: These spaces are not required by the Ada syntax
        // however, I have yet to see handwritten Ada code where
        // someone does not put spaces around :
        begin: '\\s+:\\s+',
        end: '\\s*(:=|;|\\)|=>|$)',
        // endsWithParent: true,
        // returnBegin: true,
        illegal: BAD_CHARS,
        contains: [
          {
            // workaround to avoid highlighting
            // named loops and declare blocks
            beginKeywords: 'loop for declare others',
            endsParent: true
          },
          {
            // properly highlight all modifiers
            className: 'keyword',
            beginKeywords: 'not null constant access function procedure in out aliased exception'
          },
          {
            className: 'type',
            begin: ID_REGEX,
            endsParent: true,
            relevance: 0
          }
        ]
      };

      const KEYWORDS = [
        "abort",
        "else",
        "new",
        "return",
        "abs",
        "elsif",
        "not",
        "reverse",
        "abstract",
        "end",
        "accept",
        "entry",
        "select",
        "access",
        "exception",
        "of",
        "separate",
        "aliased",
        "exit",
        "or",
        "some",
        "all",
        "others",
        "subtype",
        "and",
        "for",
        "out",
        "synchronized",
        "array",
        "function",
        "overriding",
        "at",
        "tagged",
        "generic",
        "package",
        "task",
        "begin",
        "goto",
        "pragma",
        "terminate",
        "body",
        "private",
        "then",
        "if",
        "procedure",
        "type",
        "case",
        "in",
        "protected",
        "constant",
        "interface",
        "is",
        "raise",
        "use",
        "declare",
        "range",
        "delay",
        "limited",
        "record",
        "when",
        "delta",
        "loop",
        "rem",
        "while",
        "digits",
        "renames",
        "with",
        "do",
        "mod",
        "requeue",
        "xor"
      ];

      return {
        name: 'Ada',
        case_insensitive: true,
        keywords: {
          keyword: KEYWORDS,
          literal: [
            "True",
            "False"
          ]
        },
        contains: [
          COMMENTS,
          // strings "foobar"
          {
            className: 'string',
            begin: /"/,
            end: /"/,
            contains: [
              {
                begin: /""/,
                relevance: 0
              }
            ]
          },
          // characters ''
          {
            // character literals always contain one char
            className: 'string',
            begin: /'.'/
          },
          {
            // number literals
            className: 'number',
            begin: NUMBER_RE,
            relevance: 0
          },
          {
            // Attributes
            className: 'symbol',
            begin: "'" + ID_REGEX
          },
          {
            // package definition, maybe inside generic
            className: 'title',
            begin: '(\\bwith\\s+)?(\\bprivate\\s+)?\\bpackage\\s+(\\bbody\\s+)?',
            end: '(is|$)',
            keywords: 'package body',
            excludeBegin: true,
            excludeEnd: true,
            illegal: BAD_CHARS
          },
          {
            // function/procedure declaration/definition
            // maybe inside generic
            begin: '(\\b(with|overriding)\\s+)?\\b(function|procedure)\\s+',
            end: '(\\bis|\\bwith|\\brenames|\\)\\s*;)',
            keywords: 'overriding function procedure with is renames return',
            // we need to re-match the 'function' keyword, so that
            // the title mode below matches only exactly once
            returnBegin: true,
            contains:
                    [
                      COMMENTS,
                      {
                        // name of the function/procedure
                        className: 'title',
                        begin: '(\\bwith\\s+)?\\b(function|procedure)\\s+',
                        end: '(\\(|\\s+|$)',
                        excludeBegin: true,
                        excludeEnd: true,
                        illegal: BAD_CHARS
                      },
                      // 'self'
                      // // parameter types
                      VAR_DECLS,
                      {
                        // return type
                        className: 'type',
                        begin: '\\breturn\\s+',
                        end: '(\\s+|;|$)',
                        keywords: 'return',
                        excludeBegin: true,
                        excludeEnd: true,
                        // we are done with functions
                        endsParent: true,
                        illegal: BAD_CHARS

                      }
                    ]
          },
          {
            // new type declarations
            // maybe inside generic
            className: 'type',
            begin: '\\b(sub)?type\\s+',
            end: '\\s+',
            keywords: 'type',
            excludeBegin: true,
            illegal: BAD_CHARS
          },

          // see comment above the definition
          VAR_DECLS

          // no markup
          // relevance boosters for small snippets
          // {begin: '\\s*=>\\s*'},
          // {begin: '\\s*:=\\s*'},
          // {begin: '\\s+:=\\s+'},
        ]
      };
    }

    /*
    Language: ARM Assembly
    Author: Dan Panzarella <alsoelp@gmail.com>
    Description: ARM Assembly including Thumb and Thumb2 instructions
    Category: assembler
    */

    /** @type LanguageFn */
    function armasm(hljs) {
      // local labels: %?[FB]?[AT]?\d{1,2}\w+

      const COMMENT = { variants: [
        hljs.COMMENT('^[ \\t]*(?=#)', '$', {
          relevance: 0,
          excludeBegin: true
        }),
        hljs.COMMENT('[;@]', '$', { relevance: 0 }),
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE
      ] };

      return {
        name: 'ARM Assembly',
        case_insensitive: true,
        aliases: [ 'arm' ],
        keywords: {
          $pattern: '\\.?' + hljs.IDENT_RE,
          meta:
            // GNU preprocs
            '.2byte .4byte .align .ascii .asciz .balign .byte .code .data .else .end .endif .endm .endr .equ .err .exitm .extern .global .hword .if .ifdef .ifndef .include .irp .long .macro .rept .req .section .set .skip .space .text .word .arm .thumb .code16 .code32 .force_thumb .thumb_func .ltorg '
            // ARM directives
            + 'ALIAS ALIGN ARM AREA ASSERT ATTR CN CODE CODE16 CODE32 COMMON CP DATA DCB DCD DCDU DCDO DCFD DCFDU DCI DCQ DCQU DCW DCWU DN ELIF ELSE END ENDFUNC ENDIF ENDP ENTRY EQU EXPORT EXPORTAS EXTERN FIELD FILL FUNCTION GBLA GBLL GBLS GET GLOBAL IF IMPORT INCBIN INCLUDE INFO KEEP LCLA LCLL LCLS LTORG MACRO MAP MEND MEXIT NOFP OPT PRESERVE8 PROC QN READONLY RELOC REQUIRE REQUIRE8 RLIST FN ROUT SETA SETL SETS SN SPACE SUBT THUMB THUMBX TTL WHILE WEND ',
          built_in:
            'r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 ' // standard registers
            + 'pc lr sp ip sl sb fp ' // typical regs plus backward compatibility
            + 'a1 a2 a3 a4 v1 v2 v3 v4 v5 v6 v7 v8 f0 f1 f2 f3 f4 f5 f6 f7 ' // more regs and fp
            + 'p0 p1 p2 p3 p4 p5 p6 p7 p8 p9 p10 p11 p12 p13 p14 p15 ' // coprocessor regs
            + 'c0 c1 c2 c3 c4 c5 c6 c7 c8 c9 c10 c11 c12 c13 c14 c15 ' // more coproc
            + 'q0 q1 q2 q3 q4 q5 q6 q7 q8 q9 q10 q11 q12 q13 q14 q15 ' // advanced SIMD NEON regs

            // program status registers
            + 'cpsr_c cpsr_x cpsr_s cpsr_f cpsr_cx cpsr_cxs cpsr_xs cpsr_xsf cpsr_sf cpsr_cxsf '
            + 'spsr_c spsr_x spsr_s spsr_f spsr_cx spsr_cxs spsr_xs spsr_xsf spsr_sf spsr_cxsf '

            // NEON and VFP registers
            + 's0 s1 s2 s3 s4 s5 s6 s7 s8 s9 s10 s11 s12 s13 s14 s15 '
            + 's16 s17 s18 s19 s20 s21 s22 s23 s24 s25 s26 s27 s28 s29 s30 s31 '
            + 'd0 d1 d2 d3 d4 d5 d6 d7 d8 d9 d10 d11 d12 d13 d14 d15 '
            + 'd16 d17 d18 d19 d20 d21 d22 d23 d24 d25 d26 d27 d28 d29 d30 d31 '

            + '{PC} {VAR} {TRUE} {FALSE} {OPT} {CONFIG} {ENDIAN} {CODESIZE} {CPU} {FPU} {ARCHITECTURE} {PCSTOREOFFSET} {ARMASM_VERSION} {INTER} {ROPI} {RWPI} {SWST} {NOSWST} . @'
        },
        contains: [
          {
            className: 'keyword',
            begin: '\\b(' // mnemonics
                + 'adc|'
                + '(qd?|sh?|u[qh]?)?add(8|16)?|usada?8|(q|sh?|u[qh]?)?(as|sa)x|'
                + 'and|adrl?|sbc|rs[bc]|asr|b[lx]?|blx|bxj|cbn?z|tb[bh]|bic|'
                + 'bfc|bfi|[su]bfx|bkpt|cdp2?|clz|clrex|cmp|cmn|cpsi[ed]|cps|'
                + 'setend|dbg|dmb|dsb|eor|isb|it[te]{0,3}|lsl|lsr|ror|rrx|'
                + 'ldm(([id][ab])|f[ds])?|ldr((s|ex)?[bhd])?|movt?|mvn|mra|mar|'
                + 'mul|[us]mull|smul[bwt][bt]|smu[as]d|smmul|smmla|'
                + 'mla|umlaal|smlal?([wbt][bt]|d)|mls|smlsl?[ds]|smc|svc|sev|'
                + 'mia([bt]{2}|ph)?|mrr?c2?|mcrr2?|mrs|msr|orr|orn|pkh(tb|bt)|rbit|'
                + 'rev(16|sh)?|sel|[su]sat(16)?|nop|pop|push|rfe([id][ab])?|'
                + 'stm([id][ab])?|str(ex)?[bhd]?|(qd?)?sub|(sh?|q|u[qh]?)?sub(8|16)|'
                + '[su]xt(a?h|a?b(16)?)|srs([id][ab])?|swpb?|swi|smi|tst|teq|'
                + 'wfe|wfi|yield'
            + ')'
            + '(eq|ne|cs|cc|mi|pl|vs|vc|hi|ls|ge|lt|gt|le|al|hs|lo)?' // condition codes
            + '[sptrx]?' // legal postfixes
            + '(?=\\s)' // followed by space
          },
          COMMENT,
          hljs.QUOTE_STRING_MODE,
          {
            className: 'string',
            begin: '\'',
            end: '[^\\\\]\'',
            relevance: 0
          },
          {
            className: 'title',
            begin: '\\|',
            end: '\\|',
            illegal: '\\n',
            relevance: 0
          },
          {
            className: 'number',
            variants: [
              { // hex
                begin: '[#$=]?0x[0-9a-f]+' },
              { // bin
                begin: '[#$=]?0b[01]+' },
              { // literal
                begin: '[#$=]\\d+' },
              { // bare number
                begin: '\\b\\d+' }
            ],
            relevance: 0
          },
          {
            className: 'symbol',
            variants: [
              { // GNU ARM syntax
                begin: '^[ \\t]*[a-z_\\.\\$][a-z0-9_\\.\\$]+:' },
              { // ARM syntax
                begin: '^[a-z_\\.\\$][a-z0-9_\\.\\$]+' },
              { // label reference
                begin: '[=#]\\w+' }
            ],
            relevance: 0
          }
        ]
      };
    }

    /*
    Language: AVR Assembly
    Author: Vladimir Ermakov <vooon341@gmail.com>
    Category: assembler
    Website: https://www.microchip.com/webdoc/avrassembler/avrassembler.wb_instruction_list.html
    */

    /** @type LanguageFn */
    function avrasm(hljs) {
      return {
        name: 'AVR Assembly',
        case_insensitive: true,
        keywords: {
          $pattern: '\\.?' + hljs.IDENT_RE,
          keyword:
            /* mnemonic */
            'adc add adiw and andi asr bclr bld brbc brbs brcc brcs break breq brge brhc brhs '
            + 'brid brie brlo brlt brmi brne brpl brsh brtc brts brvc brvs bset bst call cbi cbr '
            + 'clc clh cli cln clr cls clt clv clz com cp cpc cpi cpse dec eicall eijmp elpm eor '
            + 'fmul fmuls fmulsu icall ijmp in inc jmp ld ldd ldi lds lpm lsl lsr mov movw mul '
            + 'muls mulsu neg nop or ori out pop push rcall ret reti rjmp rol ror sbc sbr sbrc sbrs '
            + 'sec seh sbi sbci sbic sbis sbiw sei sen ser ses set sev sez sleep spm st std sts sub '
            + 'subi swap tst wdr',
          built_in:
            /* general purpose registers */
            'r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 r16 r17 r18 r19 r20 r21 r22 '
            + 'r23 r24 r25 r26 r27 r28 r29 r30 r31 x|0 xh xl y|0 yh yl z|0 zh zl '
            /* IO Registers (ATMega128) */
            + 'ucsr1c udr1 ucsr1a ucsr1b ubrr1l ubrr1h ucsr0c ubrr0h tccr3c tccr3a tccr3b tcnt3h '
            + 'tcnt3l ocr3ah ocr3al ocr3bh ocr3bl ocr3ch ocr3cl icr3h icr3l etimsk etifr tccr1c '
            + 'ocr1ch ocr1cl twcr twdr twar twsr twbr osccal xmcra xmcrb eicra spmcsr spmcr portg '
            + 'ddrg ping portf ddrf sreg sph spl xdiv rampz eicrb eimsk gimsk gicr eifr gifr timsk '
            + 'tifr mcucr mcucsr tccr0 tcnt0 ocr0 assr tccr1a tccr1b tcnt1h tcnt1l ocr1ah ocr1al '
            + 'ocr1bh ocr1bl icr1h icr1l tccr2 tcnt2 ocr2 ocdr wdtcr sfior eearh eearl eedr eecr '
            + 'porta ddra pina portb ddrb pinb portc ddrc pinc portd ddrd pind spdr spsr spcr udr0 '
            + 'ucsr0a ucsr0b ubrr0l acsr admux adcsr adch adcl porte ddre pine pinf',
          meta:
            '.byte .cseg .db .def .device .dseg .dw .endmacro .equ .eseg .exit .include .list '
            + '.listmac .macro .nolist .org .set'
        },
        contains: [
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.COMMENT(
            ';',
            '$',
            { relevance: 0 }
          ),
          hljs.C_NUMBER_MODE, // 0x..., decimal, float
          hljs.BINARY_NUMBER_MODE, // 0b...
          {
            className: 'number',
            begin: '\\b(\\$[a-zA-Z0-9]+|0o[0-7]+)' // $..., 0o...
          },
          hljs.QUOTE_STRING_MODE,
          {
            className: 'string',
            begin: '\'',
            end: '[^\\\\]\'',
            illegal: '[^\\\\][^\']'
          },
          {
            className: 'symbol',
            begin: '^[A-Za-z0-9_.$]+:'
          },
          {
            className: 'meta',
            begin: '#',
            end: '$'
          },
          { // substitution within a macro
            className: 'subst',
            begin: '@[0-9]+'
          }
        ]
      };
    }

    /*
    Language: Awk
    Author: Matthew Daly <matthewbdaly@gmail.com>
    Website: https://www.gnu.org/software/gawk/manual/gawk.html
    Description: language definition for Awk scripts
    */

    /** @type LanguageFn */
    function awk(hljs) {
      const VARIABLE = {
        className: 'variable',
        variants: [
          { begin: /\$[\w\d#@][\w\d_]*/ },
          { begin: /\$\{(.*?)\}/ }
        ]
      };
      const KEYWORDS = 'BEGIN END if else while do for in break continue delete next nextfile function func exit|10';
      const STRING = {
        className: 'string',
        contains: [ hljs.BACKSLASH_ESCAPE ],
        variants: [
          {
            begin: /(u|b)?r?'''/,
            end: /'''/,
            relevance: 10
          },
          {
            begin: /(u|b)?r?"""/,
            end: /"""/,
            relevance: 10
          },
          {
            begin: /(u|r|ur)'/,
            end: /'/,
            relevance: 10
          },
          {
            begin: /(u|r|ur)"/,
            end: /"/,
            relevance: 10
          },
          {
            begin: /(b|br)'/,
            end: /'/
          },
          {
            begin: /(b|br)"/,
            end: /"/
          },
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE
        ]
      };
      return {
        name: 'Awk',
        keywords: { keyword: KEYWORDS },
        contains: [
          VARIABLE,
          STRING,
          hljs.REGEXP_MODE,
          hljs.HASH_COMMENT_MODE,
          hljs.NUMBER_MODE
        ]
      };
    }

    /*
    Language: Bash
    Author: vah <vahtenberg@gmail.com>
    Contributrors: Benjamin Pannell <contact@sierrasoftworks.com>
    Website: https://www.gnu.org/software/bash/
    Category: common
    */

    /** @type LanguageFn */
    function bash(hljs) {
      const regex = hljs.regex;
      const VAR = {};
      const BRACED_VAR = {
        begin: /\$\{/,
        end: /\}/,
        contains: [
          "self",
          {
            begin: /:-/,
            contains: [ VAR ]
          } // default values
        ]
      };
      Object.assign(VAR, {
        className: 'variable',
        variants: [
          { begin: regex.concat(/\$[\w\d#@][\w\d_]*/,
            // negative look-ahead tries to avoid matching patterns that are not
            // Perl at all like $ident$, @ident@, etc.
            `(?![\\w\\d])(?![$])`) },
          BRACED_VAR
        ]
      });

      const SUBST = {
        className: 'subst',
        begin: /\$\(/,
        end: /\)/,
        contains: [ hljs.BACKSLASH_ESCAPE ]
      };
      const HERE_DOC = {
        begin: /<<-?\s*(?=\w+)/,
        starts: { contains: [
          hljs.END_SAME_AS_BEGIN({
            begin: /(\w+)/,
            end: /(\w+)/,
            className: 'string'
          })
        ] }
      };
      const QUOTE_STRING = {
        className: 'string',
        begin: /"/,
        end: /"/,
        contains: [
          hljs.BACKSLASH_ESCAPE,
          VAR,
          SUBST
        ]
      };
      SUBST.contains.push(QUOTE_STRING);
      const ESCAPED_QUOTE = {
        className: '',
        begin: /\\"/

      };
      const APOS_STRING = {
        className: 'string',
        begin: /'/,
        end: /'/
      };
      const ARITHMETIC = {
        begin: /\$?\(\(/,
        end: /\)\)/,
        contains: [
          {
            begin: /\d+#[0-9a-f]+/,
            className: "number"
          },
          hljs.NUMBER_MODE,
          VAR
        ]
      };
      const SH_LIKE_SHELLS = [
        "fish",
        "bash",
        "zsh",
        "sh",
        "csh",
        "ksh",
        "tcsh",
        "dash",
        "scsh",
      ];
      const KNOWN_SHEBANG = hljs.SHEBANG({
        binary: `(${SH_LIKE_SHELLS.join("|")})`,
        relevance: 10
      });
      const FUNCTION = {
        className: 'function',
        begin: /\w[\w\d_]*\s*\(\s*\)\s*\{/,
        returnBegin: true,
        contains: [ hljs.inherit(hljs.TITLE_MODE, { begin: /\w[\w\d_]*/ }) ],
        relevance: 0
      };

      const KEYWORDS = [
        "if",
        "then",
        "else",
        "elif",
        "fi",
        "for",
        "while",
        "in",
        "do",
        "done",
        "case",
        "esac",
        "function"
      ];

      const LITERALS = [
        "true",
        "false"
      ];

      // to consume paths to prevent keyword matches inside them
      const PATH_MODE = { match: /(\/[a-z._-]+)+/ };

      // http://www.gnu.org/software/bash/manual/html_node/Shell-Builtin-Commands.html
      const SHELL_BUILT_INS = [
        "break",
        "cd",
        "continue",
        "eval",
        "exec",
        "exit",
        "export",
        "getopts",
        "hash",
        "pwd",
        "readonly",
        "return",
        "shift",
        "test",
        "times",
        "trap",
        "umask",
        "unset"
      ];

      const BASH_BUILT_INS = [
        "alias",
        "bind",
        "builtin",
        "caller",
        "command",
        "declare",
        "echo",
        "enable",
        "help",
        "let",
        "local",
        "logout",
        "mapfile",
        "printf",
        "read",
        "readarray",
        "source",
        "type",
        "typeset",
        "ulimit",
        "unalias"
      ];

      const ZSH_BUILT_INS = [
        "autoload",
        "bg",
        "bindkey",
        "bye",
        "cap",
        "chdir",
        "clone",
        "comparguments",
        "compcall",
        "compctl",
        "compdescribe",
        "compfiles",
        "compgroups",
        "compquote",
        "comptags",
        "comptry",
        "compvalues",
        "dirs",
        "disable",
        "disown",
        "echotc",
        "echoti",
        "emulate",
        "fc",
        "fg",
        "float",
        "functions",
        "getcap",
        "getln",
        "history",
        "integer",
        "jobs",
        "kill",
        "limit",
        "log",
        "noglob",
        "popd",
        "print",
        "pushd",
        "pushln",
        "rehash",
        "sched",
        "setcap",
        "setopt",
        "stat",
        "suspend",
        "ttyctl",
        "unfunction",
        "unhash",
        "unlimit",
        "unsetopt",
        "vared",
        "wait",
        "whence",
        "where",
        "which",
        "zcompile",
        "zformat",
        "zftp",
        "zle",
        "zmodload",
        "zparseopts",
        "zprof",
        "zpty",
        "zregexparse",
        "zsocket",
        "zstyle",
        "ztcp"
      ];

      const GNU_CORE_UTILS = [
        "chcon",
        "chgrp",
        "chown",
        "chmod",
        "cp",
        "dd",
        "df",
        "dir",
        "dircolors",
        "ln",
        "ls",
        "mkdir",
        "mkfifo",
        "mknod",
        "mktemp",
        "mv",
        "realpath",
        "rm",
        "rmdir",
        "shred",
        "sync",
        "touch",
        "truncate",
        "vdir",
        "b2sum",
        "base32",
        "base64",
        "cat",
        "cksum",
        "comm",
        "csplit",
        "cut",
        "expand",
        "fmt",
        "fold",
        "head",
        "join",
        "md5sum",
        "nl",
        "numfmt",
        "od",
        "paste",
        "ptx",
        "pr",
        "sha1sum",
        "sha224sum",
        "sha256sum",
        "sha384sum",
        "sha512sum",
        "shuf",
        "sort",
        "split",
        "sum",
        "tac",
        "tail",
        "tr",
        "tsort",
        "unexpand",
        "uniq",
        "wc",
        "arch",
        "basename",
        "chroot",
        "date",
        "dirname",
        "du",
        "echo",
        "env",
        "expr",
        "factor",
        // "false", // keyword literal already
        "groups",
        "hostid",
        "id",
        "link",
        "logname",
        "nice",
        "nohup",
        "nproc",
        "pathchk",
        "pinky",
        "printenv",
        "printf",
        "pwd",
        "readlink",
        "runcon",
        "seq",
        "sleep",
        "stat",
        "stdbuf",
        "stty",
        "tee",
        "test",
        "timeout",
        // "true", // keyword literal already
        "tty",
        "uname",
        "unlink",
        "uptime",
        "users",
        "who",
        "whoami",
        "yes"
      ];

      return {
        name: 'Bash',
        aliases: [ 'sh' ],
        keywords: {
          $pattern: /\b[a-z][a-z0-9._-]+\b/,
          keyword: KEYWORDS,
          literal: LITERALS,
          built_in: [
            ...SHELL_BUILT_INS,
            ...BASH_BUILT_INS,
            // Shell modifiers
            "set",
            "shopt",
            ...ZSH_BUILT_INS,
            ...GNU_CORE_UTILS
          ]
        },
        contains: [
          KNOWN_SHEBANG, // to catch known shells and boost relevancy
          hljs.SHEBANG(), // to catch unknown shells but still highlight the shebang
          FUNCTION,
          ARITHMETIC,
          hljs.HASH_COMMENT_MODE,
          HERE_DOC,
          PATH_MODE,
          QUOTE_STRING,
          ESCAPED_QUOTE,
          APOS_STRING,
          VAR
        ]
      };
    }

    /*
    Language: Backus–Naur Form
    Website: https://en.wikipedia.org/wiki/Backus–Naur_form
    Author: Oleg Efimov <efimovov@gmail.com>
    */

    /** @type LanguageFn */
    function bnf(hljs) {
      return {
        name: 'Backus–Naur Form',
        contains: [
          // Attribute
          {
            className: 'attribute',
            begin: /</,
            end: />/
          },
          // Specific
          {
            begin: /::=/,
            end: /$/,
            contains: [
              {
                begin: /</,
                end: />/
              },
              // Common
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE,
              hljs.APOS_STRING_MODE,
              hljs.QUOTE_STRING_MODE
            ]
          }
        ]
      };
    }

    /*
    Language: C
    Category: common, system
    Website: https://en.wikipedia.org/wiki/C_(programming_language)
    */

    /** @type LanguageFn */
    function c(hljs) {
      const regex = hljs.regex;
      // added for historic reasons because `hljs.C_LINE_COMMENT_MODE` does
      // not include such support nor can we be sure all the grammars depending
      // on it would desire this behavior
      const C_LINE_COMMENT_MODE = hljs.COMMENT('//', '$', { contains: [ { begin: /\\\n/ } ] });
      const DECLTYPE_AUTO_RE = 'decltype\\(auto\\)';
      const NAMESPACE_RE = '[a-zA-Z_]\\w*::';
      const TEMPLATE_ARGUMENT_RE = '<[^<>]+>';
      const FUNCTION_TYPE_RE = '('
        + DECLTYPE_AUTO_RE + '|'
        + regex.optional(NAMESPACE_RE)
        + '[a-zA-Z_]\\w*' + regex.optional(TEMPLATE_ARGUMENT_RE)
      + ')';


      const TYPES = {
        className: 'type',
        variants: [
          { begin: '\\b[a-z\\d_]*_t\\b' },
          { match: /\batomic_[a-z]{3,6}\b/ }
        ]

      };

      // https://en.cppreference.com/w/cpp/language/escape
      // \\ \x \xFF \u2837 \u00323747 \374
      const CHARACTER_ESCAPES = '\\\\(x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4,8}|[0-7]{3}|\\S)';
      const STRINGS = {
        className: 'string',
        variants: [
          {
            begin: '(u8?|U|L)?"',
            end: '"',
            illegal: '\\n',
            contains: [ hljs.BACKSLASH_ESCAPE ]
          },
          {
            begin: '(u8?|U|L)?\'(' + CHARACTER_ESCAPES + "|.)",
            end: '\'',
            illegal: '.'
          },
          hljs.END_SAME_AS_BEGIN({
            begin: /(?:u8?|U|L)?R"([^()\\ ]{0,16})\(/,
            end: /\)([^()\\ ]{0,16})"/
          })
        ]
      };

      const NUMBERS = {
        className: 'number',
        variants: [
          { begin: '\\b(0b[01\']+)' },
          { begin: '(-?)\\b([\\d\']+(\\.[\\d\']*)?|\\.[\\d\']+)((ll|LL|l|L)(u|U)?|(u|U)(ll|LL|l|L)?|f|F|b|B)' },
          { begin: '(-?)(\\b0[xX][a-fA-F0-9\']+|(\\b[\\d\']+(\\.[\\d\']*)?|\\.[\\d\']+)([eE][-+]?[\\d\']+)?)' }
        ],
        relevance: 0
      };

      const PREPROCESSOR = {
        className: 'meta',
        begin: /#\s*[a-z]+\b/,
        end: /$/,
        keywords: { keyword:
            'if else elif endif define undef warning error line '
            + 'pragma _Pragma ifdef ifndef include' },
        contains: [
          {
            begin: /\\\n/,
            relevance: 0
          },
          hljs.inherit(STRINGS, { className: 'string' }),
          {
            className: 'string',
            begin: /<.*?>/
          },
          C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ]
      };

      const TITLE_MODE = {
        className: 'title',
        begin: regex.optional(NAMESPACE_RE) + hljs.IDENT_RE,
        relevance: 0
      };

      const FUNCTION_TITLE = regex.optional(NAMESPACE_RE) + hljs.IDENT_RE + '\\s*\\(';

      const C_KEYWORDS = [
        "asm",
        "auto",
        "break",
        "case",
        "continue",
        "default",
        "do",
        "else",
        "enum",
        "extern",
        "for",
        "fortran",
        "goto",
        "if",
        "inline",
        "register",
        "restrict",
        "return",
        "sizeof",
        "struct",
        "switch",
        "typedef",
        "union",
        "volatile",
        "while",
        "_Alignas",
        "_Alignof",
        "_Atomic",
        "_Generic",
        "_Noreturn",
        "_Static_assert",
        "_Thread_local",
        // aliases
        "alignas",
        "alignof",
        "noreturn",
        "static_assert",
        "thread_local",
        // not a C keyword but is, for all intents and purposes, treated exactly like one.
        "_Pragma"
      ];

      const C_TYPES = [
        "float",
        "double",
        "signed",
        "unsigned",
        "int",
        "short",
        "long",
        "char",
        "void",
        "_Bool",
        "_Complex",
        "_Imaginary",
        "_Decimal32",
        "_Decimal64",
        "_Decimal128",
        // modifiers
        "const",
        "static",
        // aliases
        "complex",
        "bool",
        "imaginary"
      ];

      const KEYWORDS = {
        keyword: C_KEYWORDS,
        type: C_TYPES,
        literal: 'true false NULL',
        // TODO: apply hinting work similar to what was done in cpp.js
        built_in: 'std string wstring cin cout cerr clog stdin stdout stderr stringstream istringstream ostringstream '
          + 'auto_ptr deque list queue stack vector map set pair bitset multiset multimap unordered_set '
          + 'unordered_map unordered_multiset unordered_multimap priority_queue make_pair array shared_ptr abort terminate abs acos '
          + 'asin atan2 atan calloc ceil cosh cos exit exp fabs floor fmod fprintf fputs free frexp '
          + 'fscanf future isalnum isalpha iscntrl isdigit isgraph islower isprint ispunct isspace isupper '
          + 'isxdigit tolower toupper labs ldexp log10 log malloc realloc memchr memcmp memcpy memset modf pow '
          + 'printf putchar puts scanf sinh sin snprintf sprintf sqrt sscanf strcat strchr strcmp '
          + 'strcpy strcspn strlen strncat strncmp strncpy strpbrk strrchr strspn strstr tanh tan '
          + 'vfprintf vprintf vsprintf endl initializer_list unique_ptr',
      };

      const EXPRESSION_CONTAINS = [
        PREPROCESSOR,
        TYPES,
        C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        NUMBERS,
        STRINGS
      ];

      const EXPRESSION_CONTEXT = {
        // This mode covers expression context where we can't expect a function
        // definition and shouldn't highlight anything that looks like one:
        // `return some()`, `else if()`, `(x*sum(1, 2))`
        variants: [
          {
            begin: /=/,
            end: /;/
          },
          {
            begin: /\(/,
            end: /\)/
          },
          {
            beginKeywords: 'new throw return else',
            end: /;/
          }
        ],
        keywords: KEYWORDS,
        contains: EXPRESSION_CONTAINS.concat([
          {
            begin: /\(/,
            end: /\)/,
            keywords: KEYWORDS,
            contains: EXPRESSION_CONTAINS.concat([ 'self' ]),
            relevance: 0
          }
        ]),
        relevance: 0
      };

      const FUNCTION_DECLARATION = {
        begin: '(' + FUNCTION_TYPE_RE + '[\\*&\\s]+)+' + FUNCTION_TITLE,
        returnBegin: true,
        end: /[{;=]/,
        excludeEnd: true,
        keywords: KEYWORDS,
        illegal: /[^\w\s\*&:<>.]/,
        contains: [
          { // to prevent it from being confused as the function title
            begin: DECLTYPE_AUTO_RE,
            keywords: KEYWORDS,
            relevance: 0
          },
          {
            begin: FUNCTION_TITLE,
            returnBegin: true,
            contains: [ hljs.inherit(TITLE_MODE, { className: "title.function" }) ],
            relevance: 0
          },
          // allow for multiple declarations, e.g.:
          // extern void f(int), g(char);
          {
            relevance: 0,
            match: /,/
          },
          {
            className: 'params',
            begin: /\(/,
            end: /\)/,
            keywords: KEYWORDS,
            relevance: 0,
            contains: [
              C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE,
              STRINGS,
              NUMBERS,
              TYPES,
              // Count matching parentheses.
              {
                begin: /\(/,
                end: /\)/,
                keywords: KEYWORDS,
                relevance: 0,
                contains: [
                  'self',
                  C_LINE_COMMENT_MODE,
                  hljs.C_BLOCK_COMMENT_MODE,
                  STRINGS,
                  NUMBERS,
                  TYPES
                ]
              }
            ]
          },
          TYPES,
          C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          PREPROCESSOR
        ]
      };

      return {
        name: "C",
        aliases: [ 'h' ],
        keywords: KEYWORDS,
        // Until differentiations are added between `c` and `cpp`, `c` will
        // not be auto-detected to avoid auto-detect conflicts between C and C++
        disableAutodetect: true,
        illegal: '</',
        contains: [].concat(
          EXPRESSION_CONTEXT,
          FUNCTION_DECLARATION,
          EXPRESSION_CONTAINS,
          [
            PREPROCESSOR,
            {
              begin: hljs.IDENT_RE + '::',
              keywords: KEYWORDS
            },
            {
              className: 'class',
              beginKeywords: 'enum class struct union',
              end: /[{;:<>=]/,
              contains: [
                { beginKeywords: "final class struct" },
                hljs.TITLE_MODE
              ]
            }
          ]),
        exports: {
          preprocessor: PREPROCESSOR,
          strings: STRINGS,
          keywords: KEYWORDS
        }
      };
    }

    /*
    Language: Ceylon
    Author: Lucas Werkmeister <mail@lucaswerkmeister.de>
    Website: https://ceylon-lang.org
    */

    /** @type LanguageFn */
    function ceylon(hljs) {
      // 2.3. Identifiers and keywords
      const KEYWORDS = [
        "assembly",
        "module",
        "package",
        "import",
        "alias",
        "class",
        "interface",
        "object",
        "given",
        "value",
        "assign",
        "void",
        "function",
        "new",
        "of",
        "extends",
        "satisfies",
        "abstracts",
        "in",
        "out",
        "return",
        "break",
        "continue",
        "throw",
        "assert",
        "dynamic",
        "if",
        "else",
        "switch",
        "case",
        "for",
        "while",
        "try",
        "catch",
        "finally",
        "then",
        "let",
        "this",
        "outer",
        "super",
        "is",
        "exists",
        "nonempty"
      ];
      // 7.4.1 Declaration Modifiers
      const DECLARATION_MODIFIERS = [
        "shared",
        "abstract",
        "formal",
        "default",
        "actual",
        "variable",
        "late",
        "native",
        "deprecated",
        "final",
        "sealed",
        "annotation",
        "suppressWarnings",
        "small"
      ];
      // 7.4.2 Documentation
      const DOCUMENTATION = [
        "doc",
        "by",
        "license",
        "see",
        "throws",
        "tagged"
      ];
      const SUBST = {
        className: 'subst',
        excludeBegin: true,
        excludeEnd: true,
        begin: /``/,
        end: /``/,
        keywords: KEYWORDS,
        relevance: 10
      };
      const EXPRESSIONS = [
        {
          // verbatim string
          className: 'string',
          begin: '"""',
          end: '"""',
          relevance: 10
        },
        {
          // string literal or template
          className: 'string',
          begin: '"',
          end: '"',
          contains: [ SUBST ]
        },
        {
          // character literal
          className: 'string',
          begin: "'",
          end: "'"
        },
        {
          // numeric literal
          className: 'number',
          begin: '#[0-9a-fA-F_]+|\\$[01_]+|[0-9_]+(?:\\.[0-9_](?:[eE][+-]?\\d+)?)?[kMGTPmunpf]?',
          relevance: 0
        }
      ];
      SUBST.contains = EXPRESSIONS;

      return {
        name: 'Ceylon',
        keywords: {
          keyword: KEYWORDS.concat(DECLARATION_MODIFIERS),
          meta: DOCUMENTATION
        },
        illegal: '\\$[^01]|#[^0-9a-fA-F]',
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.COMMENT('/\\*', '\\*/', { contains: [ 'self' ] }),
          {
            // compiler annotation
            className: 'meta',
            begin: '@[a-z]\\w*(?::"[^"]*")?'
          }
        ].concat(EXPRESSIONS)
      };
    }

    /*
    Language: Clean
    Author: Camil Staps <info@camilstaps.nl>
    Category: functional
    Website: http://clean.cs.ru.nl
    */

    /** @type LanguageFn */
    function clean(hljs) {
      const KEYWORDS = [
        "if",
        "let",
        "in",
        "with",
        "where",
        "case",
        "of",
        "class",
        "instance",
        "otherwise",
        "implementation",
        "definition",
        "system",
        "module",
        "from",
        "import",
        "qualified",
        "as",
        "special",
        "code",
        "inline",
        "foreign",
        "export",
        "ccall",
        "stdcall",
        "generic",
        "derive",
        "infix",
        "infixl",
        "infixr"
      ];
      return {
        name: 'Clean',
        aliases: [
          'icl',
          'dcl'
        ],
        keywords: {
          keyword: KEYWORDS,
          built_in:
            'Int Real Char Bool',
          literal:
            'True False'
        },
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE,
          hljs.C_NUMBER_MODE,
          { // relevance booster
            begin: '->|<-[|:]?|#!?|>>=|\\{\\||\\|\\}|:==|=:|<>' }
        ]
      };
    }

    /*
    Language: Clojure
    Description: Clojure syntax (based on lisp.js)
    Author: mfornos
    Website: https://clojure.org
    Category: lisp
    */

    /** @type LanguageFn */
    function clojure(hljs) {
      const SYMBOLSTART = 'a-zA-Z_\\-!.?+*=<>&\'';
      const SYMBOL_RE = '[#]?[' + SYMBOLSTART + '][' + SYMBOLSTART + '0-9/;:$#]*';
      const globals = 'def defonce defprotocol defstruct defmulti defmethod defn- defn defmacro deftype defrecord';
      const keywords = {
        $pattern: SYMBOL_RE,
        built_in:
          // Clojure keywords
          globals + ' '
          + 'cond apply if-not if-let if not not= =|0 <|0 >|0 <=|0 >=|0 ==|0 +|0 /|0 *|0 -|0 rem '
          + 'quot neg? pos? delay? symbol? keyword? true? false? integer? empty? coll? list? '
          + 'set? ifn? fn? associative? sequential? sorted? counted? reversible? number? decimal? '
          + 'class? distinct? isa? float? rational? reduced? ratio? odd? even? char? seq? vector? '
          + 'string? map? nil? contains? zero? instance? not-every? not-any? libspec? -> ->> .. . '
          + 'inc compare do dotimes mapcat take remove take-while drop letfn drop-last take-last '
          + 'drop-while while intern condp case reduced cycle split-at split-with repeat replicate '
          + 'iterate range merge zipmap declare line-seq sort comparator sort-by dorun doall nthnext '
          + 'nthrest partition eval doseq await await-for let agent atom send send-off release-pending-sends '
          + 'add-watch mapv filterv remove-watch agent-error restart-agent set-error-handler error-handler '
          + 'set-error-mode! error-mode shutdown-agents quote var fn loop recur throw try monitor-enter '
          + 'monitor-exit macroexpand macroexpand-1 for dosync and or '
          + 'when when-not when-let comp juxt partial sequence memoize constantly complement identity assert '
          + 'peek pop doto proxy first rest cons cast coll last butlast '
          + 'sigs reify second ffirst fnext nfirst nnext meta with-meta ns in-ns create-ns import '
          + 'refer keys select-keys vals key val rseq name namespace promise into transient persistent! conj! '
          + 'assoc! dissoc! pop! disj! use class type num float double short byte boolean bigint biginteger '
          + 'bigdec print-method print-dup throw-if printf format load compile get-in update-in pr pr-on newline '
          + 'flush read slurp read-line subvec with-open memfn time re-find re-groups rand-int rand mod locking '
          + 'assert-valid-fdecl alias resolve ref deref refset swap! reset! set-validator! compare-and-set! alter-meta! '
          + 'reset-meta! commute get-validator alter ref-set ref-history-count ref-min-history ref-max-history ensure sync io! '
          + 'new next conj set! to-array future future-call into-array aset gen-class reduce map filter find empty '
          + 'hash-map hash-set sorted-map sorted-map-by sorted-set sorted-set-by vec vector seq flatten reverse assoc dissoc list '
          + 'disj get union difference intersection extend extend-type extend-protocol int nth delay count concat chunk chunk-buffer '
          + 'chunk-append chunk-first chunk-rest max min dec unchecked-inc-int unchecked-inc unchecked-dec-inc unchecked-dec unchecked-negate '
          + 'unchecked-add-int unchecked-add unchecked-subtract-int unchecked-subtract chunk-next chunk-cons chunked-seq? prn vary-meta '
          + 'lazy-seq spread list* str find-keyword keyword symbol gensym force rationalize'
      };

      const SYMBOL = {
        begin: SYMBOL_RE,
        relevance: 0
      };
      const NUMBER = {
        scope: 'number',
        relevance: 0,
        variants: [
          { match: /[-+]?0[xX][0-9a-fA-F]+N?/ }, // hexadecimal                 // 0x2a
          { match: /[-+]?0[0-7]+N?/ }, // octal                       // 052
          { match: /[-+]?[1-9][0-9]?[rR][0-9a-zA-Z]+N?/ }, // variable radix from 2 to 36 // 2r101010, 8r52, 36r16
          { match: /[-+]?[0-9]+\/[0-9]+N?/ }, // ratio                       // 1/2
          { match: /[-+]?[0-9]+((\.[0-9]*([eE][+-]?[0-9]+)?M?)|([eE][+-]?[0-9]+M?|M))/ }, // float        // 0.42 4.2E-1M 42E1 42M
          { match: /[-+]?([1-9][0-9]*|0)N?/ }, // int (don't match leading 0) // 42 42N
        ]
      };
      const CHARACTER = {
        scope: 'character',
        variants: [
          { match: /\\o[0-3]?[0-7]{1,2}/ }, // Unicode Octal 0 - 377
          { match: /\\u[0-9a-fA-F]{4}/ }, // Unicode Hex 0000 - FFFF
          { match: /\\(newline|space|tab|formfeed|backspace|return)/ }, // special characters
          {
            match: /\\\S/,
            relevance: 0
          } // any non-whitespace char
        ]
      };
      const REGEX = {
        scope: 'regex',
        begin: /#"/,
        end: /"/,
        contains: [ hljs.BACKSLASH_ESCAPE ]
      };
      const STRING = hljs.inherit(hljs.QUOTE_STRING_MODE, { illegal: null });
      const COMMA = {
        scope: 'punctuation',
        match: /,/,
        relevance: 0
      };
      const COMMENT = hljs.COMMENT(
        ';',
        '$',
        { relevance: 0 }
      );
      const LITERAL = {
        className: 'literal',
        begin: /\b(true|false|nil)\b/
      };
      const COLLECTION = {
        begin: "\\[|(#::?" + SYMBOL_RE + ")?\\{",
        end: '[\\]\\}]',
        relevance: 0
      };
      const KEY = {
        className: 'symbol',
        begin: '[:]{1,2}' + SYMBOL_RE
      };
      const LIST = {
        begin: '\\(',
        end: '\\)'
      };
      const BODY = {
        endsWithParent: true,
        relevance: 0
      };
      const NAME = {
        keywords: keywords,
        className: 'name',
        begin: SYMBOL_RE,
        relevance: 0,
        starts: BODY
      };
      const DEFAULT_CONTAINS = [
        COMMA,
        LIST,
        CHARACTER,
        REGEX,
        STRING,
        COMMENT,
        KEY,
        COLLECTION,
        NUMBER,
        LITERAL,
        SYMBOL
      ];

      const GLOBAL = {
        beginKeywords: globals,
        keywords: {
          $pattern: SYMBOL_RE,
          keyword: globals
        },
        end: '(\\[|#|\\d|"|:|\\{|\\)|\\(|$)',
        contains: [
          {
            className: 'title',
            begin: SYMBOL_RE,
            relevance: 0,
            excludeEnd: true,
            // we can only have a single title
            endsParent: true
          }
        ].concat(DEFAULT_CONTAINS)
      };

      LIST.contains = [
        GLOBAL,
        NAME,
        BODY
      ];
      BODY.contains = DEFAULT_CONTAINS;
      COLLECTION.contains = DEFAULT_CONTAINS;

      return {
        name: 'Clojure',
        aliases: [
          'clj',
          'edn'
        ],
        illegal: /\S/,
        contains: [
          COMMA,
          LIST,
          CHARACTER,
          REGEX,
          STRING,
          COMMENT,
          KEY,
          COLLECTION,
          NUMBER,
          LITERAL
        ]
      };
    }

    /*
    Language: CMake
    Description: CMake is an open-source cross-platform system for build automation.
    Author: Igor Kalnitsky <igor@kalnitsky.org>
    Website: https://cmake.org
    */

    /** @type LanguageFn */
    function cmake(hljs) {
      return {
        name: 'CMake',
        aliases: [ 'cmake.in' ],
        case_insensitive: true,
        keywords: { keyword:
            // scripting commands
            'break cmake_host_system_information cmake_minimum_required cmake_parse_arguments '
            + 'cmake_policy configure_file continue elseif else endforeach endfunction endif endmacro '
            + 'endwhile execute_process file find_file find_library find_package find_path '
            + 'find_program foreach function get_cmake_property get_directory_property '
            + 'get_filename_component get_property if include include_guard list macro '
            + 'mark_as_advanced math message option return separate_arguments '
            + 'set_directory_properties set_property set site_name string unset variable_watch while '
            // project commands
            + 'add_compile_definitions add_compile_options add_custom_command add_custom_target '
            + 'add_definitions add_dependencies add_executable add_library add_link_options '
            + 'add_subdirectory add_test aux_source_directory build_command create_test_sourcelist '
            + 'define_property enable_language enable_testing export fltk_wrap_ui '
            + 'get_source_file_property get_target_property get_test_property include_directories '
            + 'include_external_msproject include_regular_expression install link_directories '
            + 'link_libraries load_cache project qt_wrap_cpp qt_wrap_ui remove_definitions '
            + 'set_source_files_properties set_target_properties set_tests_properties source_group '
            + 'target_compile_definitions target_compile_features target_compile_options '
            + 'target_include_directories target_link_directories target_link_libraries '
            + 'target_link_options target_sources try_compile try_run '
            // CTest commands
            + 'ctest_build ctest_configure ctest_coverage ctest_empty_binary_directory ctest_memcheck '
            + 'ctest_read_custom_files ctest_run_script ctest_sleep ctest_start ctest_submit '
            + 'ctest_test ctest_update ctest_upload '
            // deprecated commands
            + 'build_name exec_program export_library_dependencies install_files install_programs '
            + 'install_targets load_command make_directory output_required_files remove '
            + 'subdir_depends subdirs use_mangled_mesa utility_source variable_requires write_file '
            + 'qt5_use_modules qt5_use_package qt5_wrap_cpp '
            // core keywords
            + 'on off true false and or not command policy target test exists is_newer_than '
            + 'is_directory is_symlink is_absolute matches less greater equal less_equal '
            + 'greater_equal strless strgreater strequal strless_equal strgreater_equal version_less '
            + 'version_greater version_equal version_less_equal version_greater_equal in_list defined' },
        contains: [
          {
            className: 'variable',
            begin: /\$\{/,
            end: /\}/
          },
          hljs.COMMENT(/#\[\[/, /]]/),
          hljs.HASH_COMMENT_MODE,
          hljs.QUOTE_STRING_MODE,
          hljs.NUMBER_MODE
        ]
      };
    }

    /*
    Language: C++
    Category: common, system
    Website: https://isocpp.org
    */

    /** @type LanguageFn */
    function cpp(hljs) {
      const regex = hljs.regex;
      // added for historic reasons because `hljs.C_LINE_COMMENT_MODE` does
      // not include such support nor can we be sure all the grammars depending
      // on it would desire this behavior
      const C_LINE_COMMENT_MODE = hljs.COMMENT('//', '$', { contains: [ { begin: /\\\n/ } ] });
      const DECLTYPE_AUTO_RE = 'decltype\\(auto\\)';
      const NAMESPACE_RE = '[a-zA-Z_]\\w*::';
      const TEMPLATE_ARGUMENT_RE = '<[^<>]+>';
      const FUNCTION_TYPE_RE = '(?!struct)('
        + DECLTYPE_AUTO_RE + '|'
        + regex.optional(NAMESPACE_RE)
        + '[a-zA-Z_]\\w*' + regex.optional(TEMPLATE_ARGUMENT_RE)
      + ')';

      const CPP_PRIMITIVE_TYPES = {
        className: 'type',
        begin: '\\b[a-z\\d_]*_t\\b'
      };

      // https://en.cppreference.com/w/cpp/language/escape
      // \\ \x \xFF \u2837 \u00323747 \374
      const CHARACTER_ESCAPES = '\\\\(x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4,8}|[0-7]{3}|\\S)';
      const STRINGS = {
        className: 'string',
        variants: [
          {
            begin: '(u8?|U|L)?"',
            end: '"',
            illegal: '\\n',
            contains: [ hljs.BACKSLASH_ESCAPE ]
          },
          {
            begin: '(u8?|U|L)?\'(' + CHARACTER_ESCAPES + '|.)',
            end: '\'',
            illegal: '.'
          },
          hljs.END_SAME_AS_BEGIN({
            begin: /(?:u8?|U|L)?R"([^()\\ ]{0,16})\(/,
            end: /\)([^()\\ ]{0,16})"/
          })
        ]
      };

      const NUMBERS = {
        className: 'number',
        variants: [
          { begin: '\\b(0b[01\']+)' },
          { begin: '(-?)\\b([\\d\']+(\\.[\\d\']*)?|\\.[\\d\']+)((ll|LL|l|L)(u|U)?|(u|U)(ll|LL|l|L)?|f|F|b|B)' },
          { begin: '(-?)(\\b0[xX][a-fA-F0-9\']+|(\\b[\\d\']+(\\.[\\d\']*)?|\\.[\\d\']+)([eE][-+]?[\\d\']+)?)' }
        ],
        relevance: 0
      };

      const PREPROCESSOR = {
        className: 'meta',
        begin: /#\s*[a-z]+\b/,
        end: /$/,
        keywords: { keyword:
            'if else elif endif define undef warning error line '
            + 'pragma _Pragma ifdef ifndef include' },
        contains: [
          {
            begin: /\\\n/,
            relevance: 0
          },
          hljs.inherit(STRINGS, { className: 'string' }),
          {
            className: 'string',
            begin: /<.*?>/
          },
          C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ]
      };

      const TITLE_MODE = {
        className: 'title',
        begin: regex.optional(NAMESPACE_RE) + hljs.IDENT_RE,
        relevance: 0
      };

      const FUNCTION_TITLE = regex.optional(NAMESPACE_RE) + hljs.IDENT_RE + '\\s*\\(';

      // https://en.cppreference.com/w/cpp/keyword
      const RESERVED_KEYWORDS = [
        'alignas',
        'alignof',
        'and',
        'and_eq',
        'asm',
        'atomic_cancel',
        'atomic_commit',
        'atomic_noexcept',
        'auto',
        'bitand',
        'bitor',
        'break',
        'case',
        'catch',
        'class',
        'co_await',
        'co_return',
        'co_yield',
        'compl',
        'concept',
        'const_cast|10',
        'consteval',
        'constexpr',
        'constinit',
        'continue',
        'decltype',
        'default',
        'delete',
        'do',
        'dynamic_cast|10',
        'else',
        'enum',
        'explicit',
        'export',
        'extern',
        'false',
        'final',
        'for',
        'friend',
        'goto',
        'if',
        'import',
        'inline',
        'module',
        'mutable',
        'namespace',
        'new',
        'noexcept',
        'not',
        'not_eq',
        'nullptr',
        'operator',
        'or',
        'or_eq',
        'override',
        'private',
        'protected',
        'public',
        'reflexpr',
        'register',
        'reinterpret_cast|10',
        'requires',
        'return',
        'sizeof',
        'static_assert',
        'static_cast|10',
        'struct',
        'switch',
        'synchronized',
        'template',
        'this',
        'thread_local',
        'throw',
        'transaction_safe',
        'transaction_safe_dynamic',
        'true',
        'try',
        'typedef',
        'typeid',
        'typename',
        'union',
        'using',
        'virtual',
        'volatile',
        'while',
        'xor',
        'xor_eq'
      ];

      // https://en.cppreference.com/w/cpp/keyword
      const RESERVED_TYPES = [
        'bool',
        'char',
        'char16_t',
        'char32_t',
        'char8_t',
        'double',
        'float',
        'int',
        'long',
        'short',
        'void',
        'wchar_t',
        'unsigned',
        'signed',
        'const',
        'static'
      ];

      const TYPE_HINTS = [
        'any',
        'auto_ptr',
        'barrier',
        'binary_semaphore',
        'bitset',
        'complex',
        'condition_variable',
        'condition_variable_any',
        'counting_semaphore',
        'deque',
        'false_type',
        'future',
        'imaginary',
        'initializer_list',
        'istringstream',
        'jthread',
        'latch',
        'lock_guard',
        'multimap',
        'multiset',
        'mutex',
        'optional',
        'ostringstream',
        'packaged_task',
        'pair',
        'promise',
        'priority_queue',
        'queue',
        'recursive_mutex',
        'recursive_timed_mutex',
        'scoped_lock',
        'set',
        'shared_future',
        'shared_lock',
        'shared_mutex',
        'shared_timed_mutex',
        'shared_ptr',
        'stack',
        'string_view',
        'stringstream',
        'timed_mutex',
        'thread',
        'true_type',
        'tuple',
        'unique_lock',
        'unique_ptr',
        'unordered_map',
        'unordered_multimap',
        'unordered_multiset',
        'unordered_set',
        'variant',
        'vector',
        'weak_ptr',
        'wstring',
        'wstring_view'
      ];

      const FUNCTION_HINTS = [
        'abort',
        'abs',
        'acos',
        'apply',
        'as_const',
        'asin',
        'atan',
        'atan2',
        'calloc',
        'ceil',
        'cerr',
        'cin',
        'clog',
        'cos',
        'cosh',
        'cout',
        'declval',
        'endl',
        'exchange',
        'exit',
        'exp',
        'fabs',
        'floor',
        'fmod',
        'forward',
        'fprintf',
        'fputs',
        'free',
        'frexp',
        'fscanf',
        'future',
        'invoke',
        'isalnum',
        'isalpha',
        'iscntrl',
        'isdigit',
        'isgraph',
        'islower',
        'isprint',
        'ispunct',
        'isspace',
        'isupper',
        'isxdigit',
        'labs',
        'launder',
        'ldexp',
        'log',
        'log10',
        'make_pair',
        'make_shared',
        'make_shared_for_overwrite',
        'make_tuple',
        'make_unique',
        'malloc',
        'memchr',
        'memcmp',
        'memcpy',
        'memset',
        'modf',
        'move',
        'pow',
        'printf',
        'putchar',
        'puts',
        'realloc',
        'scanf',
        'sin',
        'sinh',
        'snprintf',
        'sprintf',
        'sqrt',
        'sscanf',
        'std',
        'stderr',
        'stdin',
        'stdout',
        'strcat',
        'strchr',
        'strcmp',
        'strcpy',
        'strcspn',
        'strlen',
        'strncat',
        'strncmp',
        'strncpy',
        'strpbrk',
        'strrchr',
        'strspn',
        'strstr',
        'swap',
        'tan',
        'tanh',
        'terminate',
        'to_underlying',
        'tolower',
        'toupper',
        'vfprintf',
        'visit',
        'vprintf',
        'vsprintf'
      ];

      const LITERALS = [
        'NULL',
        'false',
        'nullopt',
        'nullptr',
        'true'
      ];

      // https://en.cppreference.com/w/cpp/keyword
      const BUILT_IN = [ '_Pragma' ];

      const CPP_KEYWORDS = {
        type: RESERVED_TYPES,
        keyword: RESERVED_KEYWORDS,
        literal: LITERALS,
        built_in: BUILT_IN,
        _type_hints: TYPE_HINTS
      };

      const FUNCTION_DISPATCH = {
        className: 'function.dispatch',
        relevance: 0,
        keywords: {
          // Only for relevance, not highlighting.
          _hint: FUNCTION_HINTS },
        begin: regex.concat(
          /\b/,
          /(?!decltype)/,
          /(?!if)/,
          /(?!for)/,
          /(?!switch)/,
          /(?!while)/,
          hljs.IDENT_RE,
          regex.lookahead(/(<[^<>]+>|)\s*\(/))
      };

      const EXPRESSION_CONTAINS = [
        FUNCTION_DISPATCH,
        PREPROCESSOR,
        CPP_PRIMITIVE_TYPES,
        C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        NUMBERS,
        STRINGS
      ];

      const EXPRESSION_CONTEXT = {
        // This mode covers expression context where we can't expect a function
        // definition and shouldn't highlight anything that looks like one:
        // `return some()`, `else if()`, `(x*sum(1, 2))`
        variants: [
          {
            begin: /=/,
            end: /;/
          },
          {
            begin: /\(/,
            end: /\)/
          },
          {
            beginKeywords: 'new throw return else',
            end: /;/
          }
        ],
        keywords: CPP_KEYWORDS,
        contains: EXPRESSION_CONTAINS.concat([
          {
            begin: /\(/,
            end: /\)/,
            keywords: CPP_KEYWORDS,
            contains: EXPRESSION_CONTAINS.concat([ 'self' ]),
            relevance: 0
          }
        ]),
        relevance: 0
      };

      const FUNCTION_DECLARATION = {
        className: 'function',
        begin: '(' + FUNCTION_TYPE_RE + '[\\*&\\s]+)+' + FUNCTION_TITLE,
        returnBegin: true,
        end: /[{;=]/,
        excludeEnd: true,
        keywords: CPP_KEYWORDS,
        illegal: /[^\w\s\*&:<>.]/,
        contains: [
          { // to prevent it from being confused as the function title
            begin: DECLTYPE_AUTO_RE,
            keywords: CPP_KEYWORDS,
            relevance: 0
          },
          {
            begin: FUNCTION_TITLE,
            returnBegin: true,
            contains: [ TITLE_MODE ],
            relevance: 0
          },
          // needed because we do not have look-behind on the below rule
          // to prevent it from grabbing the final : in a :: pair
          {
            begin: /::/,
            relevance: 0
          },
          // initializers
          {
            begin: /:/,
            endsWithParent: true,
            contains: [
              STRINGS,
              NUMBERS
            ]
          },
          // allow for multiple declarations, e.g.:
          // extern void f(int), g(char);
          {
            relevance: 0,
            match: /,/
          },
          {
            className: 'params',
            begin: /\(/,
            end: /\)/,
            keywords: CPP_KEYWORDS,
            relevance: 0,
            contains: [
              C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE,
              STRINGS,
              NUMBERS,
              CPP_PRIMITIVE_TYPES,
              // Count matching parentheses.
              {
                begin: /\(/,
                end: /\)/,
                keywords: CPP_KEYWORDS,
                relevance: 0,
                contains: [
                  'self',
                  C_LINE_COMMENT_MODE,
                  hljs.C_BLOCK_COMMENT_MODE,
                  STRINGS,
                  NUMBERS,
                  CPP_PRIMITIVE_TYPES
                ]
              }
            ]
          },
          CPP_PRIMITIVE_TYPES,
          C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          PREPROCESSOR
        ]
      };

      return {
        name: 'C++',
        aliases: [
          'cc',
          'c++',
          'h++',
          'hpp',
          'hh',
          'hxx',
          'cxx'
        ],
        keywords: CPP_KEYWORDS,
        illegal: '</',
        classNameAliases: { 'function.dispatch': 'built_in' },
        contains: [].concat(
          EXPRESSION_CONTEXT,
          FUNCTION_DECLARATION,
          FUNCTION_DISPATCH,
          EXPRESSION_CONTAINS,
          [
            PREPROCESSOR,
            { // containers: ie, `vector <int> rooms (9);`
              begin: '\\b(deque|list|queue|priority_queue|pair|stack|vector|map|set|bitset|multiset|multimap|unordered_map|unordered_set|unordered_multiset|unordered_multimap|array|tuple|optional|variant|function)\\s*<(?!<)',
              end: '>',
              keywords: CPP_KEYWORDS,
              contains: [
                'self',
                CPP_PRIMITIVE_TYPES
              ]
            },
            {
              begin: hljs.IDENT_RE + '::',
              keywords: CPP_KEYWORDS
            },
            {
              match: [
                // extra complexity to deal with `enum class` and `enum struct`
                /\b(?:enum(?:\s+(?:class|struct))?|class|struct|union)/,
                /\s+/,
                /\w+/
              ],
              className: {
                1: 'keyword',
                3: 'title.class'
              }
            }
          ])
      };
    }

    /*
    Language: Crystal
    Author: TSUYUSATO Kitsune <make.just.on@gmail.com>
    Website: https://crystal-lang.org
    */

    /** @type LanguageFn */
    function crystal(hljs) {
      const INT_SUFFIX = '(_?[ui](8|16|32|64|128))?';
      const FLOAT_SUFFIX = '(_?f(32|64))?';
      const CRYSTAL_IDENT_RE = '[a-zA-Z_]\\w*[!?=]?';
      const CRYSTAL_METHOD_RE = '[a-zA-Z_]\\w*[!?=]?|[-+~]@|<<|>>|[=!]~|===?|<=>|[<>]=?|\\*\\*|[-/+%^&*~|]|//|//=|&[-+*]=?|&\\*\\*|\\[\\][=?]?';
      const CRYSTAL_PATH_RE = '[A-Za-z_]\\w*(::\\w+)*(\\?|!)?';
      const CRYSTAL_KEYWORDS = {
        $pattern: CRYSTAL_IDENT_RE,
        keyword:
          'abstract alias annotation as as? asm begin break case class def do else elsif end ensure enum extend for fun if '
          + 'include instance_sizeof is_a? lib macro module next nil? of out pointerof private protected rescue responds_to? '
          + 'return require select self sizeof struct super then type typeof union uninitialized unless until verbatim when while with yield '
          + '__DIR__ __END_LINE__ __FILE__ __LINE__',
        literal: 'false nil true'
      };
      const SUBST = {
        className: 'subst',
        begin: /#\{/,
        end: /\}/,
        keywords: CRYSTAL_KEYWORDS
      };
      // borrowed from Ruby
      const VARIABLE = {
        // negative-look forward attemps to prevent false matches like:
        // @ident@ or $ident$ that might indicate this is not ruby at all
        className: "variable",
        begin: '(\\$\\W)|((\\$|@@?)(\\w+))(?=[^@$?])' + `(?![A-Za-z])(?![@$?'])`
      };
      const EXPANSION = {
        className: 'template-variable',
        variants: [
          {
            begin: '\\{\\{',
            end: '\\}\\}'
          },
          {
            begin: '\\{%',
            end: '%\\}'
          }
        ],
        keywords: CRYSTAL_KEYWORDS
      };

      function recursiveParen(begin, end) {
        const
            contains = [
              {
                begin: begin,
                end: end
              }
            ];
        contains[0].contains = contains;
        return contains;
      }
      const STRING = {
        className: 'string',
        contains: [
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ],
        variants: [
          {
            begin: /'/,
            end: /'/
          },
          {
            begin: /"/,
            end: /"/
          },
          {
            begin: /`/,
            end: /`/
          },
          {
            begin: '%[Qwi]?\\(',
            end: '\\)',
            contains: recursiveParen('\\(', '\\)')
          },
          {
            begin: '%[Qwi]?\\[',
            end: '\\]',
            contains: recursiveParen('\\[', '\\]')
          },
          {
            begin: '%[Qwi]?\\{',
            end: /\}/,
            contains: recursiveParen(/\{/, /\}/)
          },
          {
            begin: '%[Qwi]?<',
            end: '>',
            contains: recursiveParen('<', '>')
          },
          {
            begin: '%[Qwi]?\\|',
            end: '\\|'
          },
          {
            begin: /<<-\w+$/,
            end: /^\s*\w+$/
          }
        ],
        relevance: 0
      };
      const Q_STRING = {
        className: 'string',
        variants: [
          {
            begin: '%q\\(',
            end: '\\)',
            contains: recursiveParen('\\(', '\\)')
          },
          {
            begin: '%q\\[',
            end: '\\]',
            contains: recursiveParen('\\[', '\\]')
          },
          {
            begin: '%q\\{',
            end: /\}/,
            contains: recursiveParen(/\{/, /\}/)
          },
          {
            begin: '%q<',
            end: '>',
            contains: recursiveParen('<', '>')
          },
          {
            begin: '%q\\|',
            end: '\\|'
          },
          {
            begin: /<<-'\w+'$/,
            end: /^\s*\w+$/
          }
        ],
        relevance: 0
      };
      const REGEXP = {
        begin: '(?!%\\})(' + hljs.RE_STARTERS_RE + '|\\n|\\b(case|if|select|unless|until|when|while)\\b)\\s*',
        keywords: 'case if select unless until when while',
        contains: [
          {
            className: 'regexp',
            contains: [
              hljs.BACKSLASH_ESCAPE,
              SUBST
            ],
            variants: [
              {
                begin: '//[a-z]*',
                relevance: 0
              },
              {
                begin: '/(?!\\/)',
                end: '/[a-z]*'
              }
            ]
          }
        ],
        relevance: 0
      };
      const REGEXP2 = {
        className: 'regexp',
        contains: [
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ],
        variants: [
          {
            begin: '%r\\(',
            end: '\\)',
            contains: recursiveParen('\\(', '\\)')
          },
          {
            begin: '%r\\[',
            end: '\\]',
            contains: recursiveParen('\\[', '\\]')
          },
          {
            begin: '%r\\{',
            end: /\}/,
            contains: recursiveParen(/\{/, /\}/)
          },
          {
            begin: '%r<',
            end: '>',
            contains: recursiveParen('<', '>')
          },
          {
            begin: '%r\\|',
            end: '\\|'
          }
        ],
        relevance: 0
      };
      const ATTRIBUTE = {
        className: 'meta',
        begin: '@\\[',
        end: '\\]',
        contains: [ hljs.inherit(hljs.QUOTE_STRING_MODE, { className: 'string' }) ]
      };
      const CRYSTAL_DEFAULT_CONTAINS = [
        EXPANSION,
        STRING,
        Q_STRING,
        REGEXP2,
        REGEXP,
        ATTRIBUTE,
        VARIABLE,
        hljs.HASH_COMMENT_MODE,
        {
          className: 'class',
          beginKeywords: 'class module struct',
          end: '$|;',
          illegal: /=/,
          contains: [
            hljs.HASH_COMMENT_MODE,
            hljs.inherit(hljs.TITLE_MODE, { begin: CRYSTAL_PATH_RE }),
            { // relevance booster for inheritance
              begin: '<' }
          ]
        },
        {
          className: 'class',
          beginKeywords: 'lib enum union',
          end: '$|;',
          illegal: /=/,
          contains: [
            hljs.HASH_COMMENT_MODE,
            hljs.inherit(hljs.TITLE_MODE, { begin: CRYSTAL_PATH_RE })
          ]
        },
        {
          beginKeywords: 'annotation',
          end: '$|;',
          illegal: /=/,
          contains: [
            hljs.HASH_COMMENT_MODE,
            hljs.inherit(hljs.TITLE_MODE, { begin: CRYSTAL_PATH_RE })
          ],
          relevance: 2
        },
        {
          className: 'function',
          beginKeywords: 'def',
          end: /\B\b/,
          contains: [
            hljs.inherit(hljs.TITLE_MODE, {
              begin: CRYSTAL_METHOD_RE,
              endsParent: true
            })
          ]
        },
        {
          className: 'function',
          beginKeywords: 'fun macro',
          end: /\B\b/,
          contains: [
            hljs.inherit(hljs.TITLE_MODE, {
              begin: CRYSTAL_METHOD_RE,
              endsParent: true
            })
          ],
          relevance: 2
        },
        {
          className: 'symbol',
          begin: hljs.UNDERSCORE_IDENT_RE + '(!|\\?)?:',
          relevance: 0
        },
        {
          className: 'symbol',
          begin: ':',
          contains: [
            STRING,
            { begin: CRYSTAL_METHOD_RE }
          ],
          relevance: 0
        },
        {
          className: 'number',
          variants: [
            { begin: '\\b0b([01_]+)' + INT_SUFFIX },
            { begin: '\\b0o([0-7_]+)' + INT_SUFFIX },
            { begin: '\\b0x([A-Fa-f0-9_]+)' + INT_SUFFIX },
            { begin: '\\b([1-9][0-9_]*[0-9]|[0-9])(\\.[0-9][0-9_]*)?([eE]_?[-+]?[0-9_]*)?' + FLOAT_SUFFIX + '(?!_)' },
            { begin: '\\b([1-9][0-9_]*|0)' + INT_SUFFIX }
          ],
          relevance: 0
        }
      ];
      SUBST.contains = CRYSTAL_DEFAULT_CONTAINS;
      EXPANSION.contains = CRYSTAL_DEFAULT_CONTAINS.slice(1); // without EXPANSION

      return {
        name: 'Crystal',
        aliases: [ 'cr' ],
        keywords: CRYSTAL_KEYWORDS,
        contains: CRYSTAL_DEFAULT_CONTAINS
      };
    }

    /*
    Language: C#
    Author: Jason Diamond <jason@diamond.name>
    Contributor: Nicolas LLOBERA <nllobera@gmail.com>, Pieter Vantorre <pietervantorre@gmail.com>, David Pine <david.pine@microsoft.com>
    Website: https://docs.microsoft.com/dotnet/csharp/
    Category: common
    */

    /** @type LanguageFn */
    function csharp(hljs) {
      const BUILT_IN_KEYWORDS = [
        'bool',
        'byte',
        'char',
        'decimal',
        'delegate',
        'double',
        'dynamic',
        'enum',
        'float',
        'int',
        'long',
        'nint',
        'nuint',
        'object',
        'sbyte',
        'short',
        'string',
        'ulong',
        'uint',
        'ushort'
      ];
      const FUNCTION_MODIFIERS = [
        'public',
        'private',
        'protected',
        'static',
        'internal',
        'protected',
        'abstract',
        'async',
        'extern',
        'override',
        'unsafe',
        'virtual',
        'new',
        'sealed',
        'partial'
      ];
      const LITERAL_KEYWORDS = [
        'default',
        'false',
        'null',
        'true'
      ];
      const NORMAL_KEYWORDS = [
        'abstract',
        'as',
        'base',
        'break',
        'case',
        'catch',
        'class',
        'const',
        'continue',
        'do',
        'else',
        'event',
        'explicit',
        'extern',
        'finally',
        'fixed',
        'for',
        'foreach',
        'goto',
        'if',
        'implicit',
        'in',
        'interface',
        'internal',
        'is',
        'lock',
        'namespace',
        'new',
        'operator',
        'out',
        'override',
        'params',
        'private',
        'protected',
        'public',
        'readonly',
        'record',
        'ref',
        'return',
        'scoped',
        'sealed',
        'sizeof',
        'stackalloc',
        'static',
        'struct',
        'switch',
        'this',
        'throw',
        'try',
        'typeof',
        'unchecked',
        'unsafe',
        'using',
        'virtual',
        'void',
        'volatile',
        'while'
      ];
      const CONTEXTUAL_KEYWORDS = [
        'add',
        'alias',
        'and',
        'ascending',
        'async',
        'await',
        'by',
        'descending',
        'equals',
        'from',
        'get',
        'global',
        'group',
        'init',
        'into',
        'join',
        'let',
        'nameof',
        'not',
        'notnull',
        'on',
        'or',
        'orderby',
        'partial',
        'remove',
        'select',
        'set',
        'unmanaged',
        'value|0',
        'var',
        'when',
        'where',
        'with',
        'yield'
      ];

      const KEYWORDS = {
        keyword: NORMAL_KEYWORDS.concat(CONTEXTUAL_KEYWORDS),
        built_in: BUILT_IN_KEYWORDS,
        literal: LITERAL_KEYWORDS
      };
      const TITLE_MODE = hljs.inherit(hljs.TITLE_MODE, { begin: '[a-zA-Z](\\.?\\w)*' });
      const NUMBERS = {
        className: 'number',
        variants: [
          { begin: '\\b(0b[01\']+)' },
          { begin: '(-?)\\b([\\d\']+(\\.[\\d\']*)?|\\.[\\d\']+)(u|U|l|L|ul|UL|f|F|b|B)' },
          { begin: '(-?)(\\b0[xX][a-fA-F0-9\']+|(\\b[\\d\']+(\\.[\\d\']*)?|\\.[\\d\']+)([eE][-+]?[\\d\']+)?)' }
        ],
        relevance: 0
      };
      const VERBATIM_STRING = {
        className: 'string',
        begin: '@"',
        end: '"',
        contains: [ { begin: '""' } ]
      };
      const VERBATIM_STRING_NO_LF = hljs.inherit(VERBATIM_STRING, { illegal: /\n/ });
      const SUBST = {
        className: 'subst',
        begin: /\{/,
        end: /\}/,
        keywords: KEYWORDS
      };
      const SUBST_NO_LF = hljs.inherit(SUBST, { illegal: /\n/ });
      const INTERPOLATED_STRING = {
        className: 'string',
        begin: /\$"/,
        end: '"',
        illegal: /\n/,
        contains: [
          { begin: /\{\{/ },
          { begin: /\}\}/ },
          hljs.BACKSLASH_ESCAPE,
          SUBST_NO_LF
        ]
      };
      const INTERPOLATED_VERBATIM_STRING = {
        className: 'string',
        begin: /\$@"/,
        end: '"',
        contains: [
          { begin: /\{\{/ },
          { begin: /\}\}/ },
          { begin: '""' },
          SUBST
        ]
      };
      const INTERPOLATED_VERBATIM_STRING_NO_LF = hljs.inherit(INTERPOLATED_VERBATIM_STRING, {
        illegal: /\n/,
        contains: [
          { begin: /\{\{/ },
          { begin: /\}\}/ },
          { begin: '""' },
          SUBST_NO_LF
        ]
      });
      SUBST.contains = [
        INTERPOLATED_VERBATIM_STRING,
        INTERPOLATED_STRING,
        VERBATIM_STRING,
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE,
        NUMBERS,
        hljs.C_BLOCK_COMMENT_MODE
      ];
      SUBST_NO_LF.contains = [
        INTERPOLATED_VERBATIM_STRING_NO_LF,
        INTERPOLATED_STRING,
        VERBATIM_STRING_NO_LF,
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE,
        NUMBERS,
        hljs.inherit(hljs.C_BLOCK_COMMENT_MODE, { illegal: /\n/ })
      ];
      const STRING = { variants: [
        INTERPOLATED_VERBATIM_STRING,
        INTERPOLATED_STRING,
        VERBATIM_STRING,
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE
      ] };

      const GENERIC_MODIFIER = {
        begin: "<",
        end: ">",
        contains: [
          { beginKeywords: "in out" },
          TITLE_MODE
        ]
      };
      const TYPE_IDENT_RE = hljs.IDENT_RE + '(<' + hljs.IDENT_RE + '(\\s*,\\s*' + hljs.IDENT_RE + ')*>)?(\\[\\])?';
      const AT_IDENTIFIER = {
        // prevents expressions like `@class` from incorrect flagging
        // `class` as a keyword
        begin: "@" + hljs.IDENT_RE,
        relevance: 0
      };

      return {
        name: 'C#',
        aliases: [
          'cs',
          'c#'
        ],
        keywords: KEYWORDS,
        illegal: /::/,
        contains: [
          hljs.COMMENT(
            '///',
            '$',
            {
              returnBegin: true,
              contains: [
                {
                  className: 'doctag',
                  variants: [
                    {
                      begin: '///',
                      relevance: 0
                    },
                    { begin: '<!--|-->' },
                    {
                      begin: '</?',
                      end: '>'
                    }
                  ]
                }
              ]
            }
          ),
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          {
            className: 'meta',
            begin: '#',
            end: '$',
            keywords: { keyword: 'if else elif endif define undef warning error line region endregion pragma checksum' }
          },
          STRING,
          NUMBERS,
          {
            beginKeywords: 'class interface',
            relevance: 0,
            end: /[{;=]/,
            illegal: /[^\s:,]/,
            contains: [
              { beginKeywords: "where class" },
              TITLE_MODE,
              GENERIC_MODIFIER,
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          {
            beginKeywords: 'namespace',
            relevance: 0,
            end: /[{;=]/,
            illegal: /[^\s:]/,
            contains: [
              TITLE_MODE,
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          {
            beginKeywords: 'record',
            relevance: 0,
            end: /[{;=]/,
            illegal: /[^\s:]/,
            contains: [
              TITLE_MODE,
              GENERIC_MODIFIER,
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          {
            // [Attributes("")]
            className: 'meta',
            begin: '^\\s*\\[(?=[\\w])',
            excludeBegin: true,
            end: '\\]',
            excludeEnd: true,
            contains: [
              {
                className: 'string',
                begin: /"/,
                end: /"/
              }
            ]
          },
          {
            // Expression keywords prevent 'keyword Name(...)' from being
            // recognized as a function definition
            beginKeywords: 'new return throw await else',
            relevance: 0
          },
          {
            className: 'function',
            begin: '(' + TYPE_IDENT_RE + '\\s+)+' + hljs.IDENT_RE + '\\s*(<[^=]+>\\s*)?\\(',
            returnBegin: true,
            end: /\s*[{;=]/,
            excludeEnd: true,
            keywords: KEYWORDS,
            contains: [
              // prevents these from being highlighted `title`
              {
                beginKeywords: FUNCTION_MODIFIERS.join(" "),
                relevance: 0
              },
              {
                begin: hljs.IDENT_RE + '\\s*(<[^=]+>\\s*)?\\(',
                returnBegin: true,
                contains: [
                  hljs.TITLE_MODE,
                  GENERIC_MODIFIER
                ],
                relevance: 0
              },
              { match: /\(\)/ },
              {
                className: 'params',
                begin: /\(/,
                end: /\)/,
                excludeBegin: true,
                excludeEnd: true,
                keywords: KEYWORDS,
                relevance: 0,
                contains: [
                  STRING,
                  NUMBERS,
                  hljs.C_BLOCK_COMMENT_MODE
                ]
              },
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          AT_IDENTIFIER
        ]
      };
    }

    /*
    Language: CSP
    Description: Content Security Policy definition highlighting
    Author: Taras <oxdef@oxdef.info>
    Website: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP

    vim: ts=2 sw=2 st=2
    */

    /** @type LanguageFn */
    function csp(hljs) {
      const KEYWORDS = [
        "base-uri",
        "child-src",
        "connect-src",
        "default-src",
        "font-src",
        "form-action",
        "frame-ancestors",
        "frame-src",
        "img-src",
        "manifest-src",
        "media-src",
        "object-src",
        "plugin-types",
        "report-uri",
        "sandbox",
        "script-src",
        "style-src",
        "trusted-types",
        "unsafe-hashes",
        "worker-src"
      ];
      return {
        name: 'CSP',
        case_insensitive: false,
        keywords: {
          $pattern: '[a-zA-Z][a-zA-Z0-9_-]*',
          keyword: KEYWORDS
        },
        contains: [
          {
            className: 'string',
            begin: "'",
            end: "'"
          },
          {
            className: 'attribute',
            begin: '^Content',
            end: ':',
            excludeEnd: true
          }
        ]
      };
    }

    const MODES = (hljs) => {
      return {
        IMPORTANT: {
          scope: 'meta',
          begin: '!important'
        },
        BLOCK_COMMENT: hljs.C_BLOCK_COMMENT_MODE,
        HEXCOLOR: {
          scope: 'number',
          begin: /#(([0-9a-fA-F]{3,4})|(([0-9a-fA-F]{2}){3,4}))\b/
        },
        FUNCTION_DISPATCH: {
          className: "built_in",
          begin: /[\w-]+(?=\()/
        },
        ATTRIBUTE_SELECTOR_MODE: {
          scope: 'selector-attr',
          begin: /\[/,
          end: /\]/,
          illegal: '$',
          contains: [
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE
          ]
        },
        CSS_NUMBER_MODE: {
          scope: 'number',
          begin: hljs.NUMBER_RE + '(' +
            '%|em|ex|ch|rem' +
            '|vw|vh|vmin|vmax' +
            '|cm|mm|in|pt|pc|px' +
            '|deg|grad|rad|turn' +
            '|s|ms' +
            '|Hz|kHz' +
            '|dpi|dpcm|dppx' +
            ')?',
          relevance: 0
        },
        CSS_VARIABLE: {
          className: "attr",
          begin: /--[A-Za-z][A-Za-z0-9_-]*/
        }
      };
    };

    const TAGS = [
      'a',
      'abbr',
      'address',
      'article',
      'aside',
      'audio',
      'b',
      'blockquote',
      'body',
      'button',
      'canvas',
      'caption',
      'cite',
      'code',
      'dd',
      'del',
      'details',
      'dfn',
      'div',
      'dl',
      'dt',
      'em',
      'fieldset',
      'figcaption',
      'figure',
      'footer',
      'form',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'header',
      'hgroup',
      'html',
      'i',
      'iframe',
      'img',
      'input',
      'ins',
      'kbd',
      'label',
      'legend',
      'li',
      'main',
      'mark',
      'menu',
      'nav',
      'object',
      'ol',
      'p',
      'q',
      'quote',
      'samp',
      'section',
      'span',
      'strong',
      'summary',
      'sup',
      'table',
      'tbody',
      'td',
      'textarea',
      'tfoot',
      'th',
      'thead',
      'time',
      'tr',
      'ul',
      'var',
      'video'
    ];

    const MEDIA_FEATURES = [
      'any-hover',
      'any-pointer',
      'aspect-ratio',
      'color',
      'color-gamut',
      'color-index',
      'device-aspect-ratio',
      'device-height',
      'device-width',
      'display-mode',
      'forced-colors',
      'grid',
      'height',
      'hover',
      'inverted-colors',
      'monochrome',
      'orientation',
      'overflow-block',
      'overflow-inline',
      'pointer',
      'prefers-color-scheme',
      'prefers-contrast',
      'prefers-reduced-motion',
      'prefers-reduced-transparency',
      'resolution',
      'scan',
      'scripting',
      'update',
      'width',
      // TODO: find a better solution?
      'min-width',
      'max-width',
      'min-height',
      'max-height'
    ];

    // https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-classes
    const PSEUDO_CLASSES = [
      'active',
      'any-link',
      'blank',
      'checked',
      'current',
      'default',
      'defined',
      'dir', // dir()
      'disabled',
      'drop',
      'empty',
      'enabled',
      'first',
      'first-child',
      'first-of-type',
      'fullscreen',
      'future',
      'focus',
      'focus-visible',
      'focus-within',
      'has', // has()
      'host', // host or host()
      'host-context', // host-context()
      'hover',
      'indeterminate',
      'in-range',
      'invalid',
      'is', // is()
      'lang', // lang()
      'last-child',
      'last-of-type',
      'left',
      'link',
      'local-link',
      'not', // not()
      'nth-child', // nth-child()
      'nth-col', // nth-col()
      'nth-last-child', // nth-last-child()
      'nth-last-col', // nth-last-col()
      'nth-last-of-type', //nth-last-of-type()
      'nth-of-type', //nth-of-type()
      'only-child',
      'only-of-type',
      'optional',
      'out-of-range',
      'past',
      'placeholder-shown',
      'read-only',
      'read-write',
      'required',
      'right',
      'root',
      'scope',
      'target',
      'target-within',
      'user-invalid',
      'valid',
      'visited',
      'where' // where()
    ];

    // https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-elements
    const PSEUDO_ELEMENTS = [
      'after',
      'backdrop',
      'before',
      'cue',
      'cue-region',
      'first-letter',
      'first-line',
      'grammar-error',
      'marker',
      'part',
      'placeholder',
      'selection',
      'slotted',
      'spelling-error'
    ];

    const ATTRIBUTES = [
      'align-content',
      'align-items',
      'align-self',
      'all',
      'animation',
      'animation-delay',
      'animation-direction',
      'animation-duration',
      'animation-fill-mode',
      'animation-iteration-count',
      'animation-name',
      'animation-play-state',
      'animation-timing-function',
      'backface-visibility',
      'background',
      'background-attachment',
      'background-blend-mode',
      'background-clip',
      'background-color',
      'background-image',
      'background-origin',
      'background-position',
      'background-repeat',
      'background-size',
      'block-size',
      'border',
      'border-block',
      'border-block-color',
      'border-block-end',
      'border-block-end-color',
      'border-block-end-style',
      'border-block-end-width',
      'border-block-start',
      'border-block-start-color',
      'border-block-start-style',
      'border-block-start-width',
      'border-block-style',
      'border-block-width',
      'border-bottom',
      'border-bottom-color',
      'border-bottom-left-radius',
      'border-bottom-right-radius',
      'border-bottom-style',
      'border-bottom-width',
      'border-collapse',
      'border-color',
      'border-image',
      'border-image-outset',
      'border-image-repeat',
      'border-image-slice',
      'border-image-source',
      'border-image-width',
      'border-inline',
      'border-inline-color',
      'border-inline-end',
      'border-inline-end-color',
      'border-inline-end-style',
      'border-inline-end-width',
      'border-inline-start',
      'border-inline-start-color',
      'border-inline-start-style',
      'border-inline-start-width',
      'border-inline-style',
      'border-inline-width',
      'border-left',
      'border-left-color',
      'border-left-style',
      'border-left-width',
      'border-radius',
      'border-right',
      'border-right-color',
      'border-right-style',
      'border-right-width',
      'border-spacing',
      'border-style',
      'border-top',
      'border-top-color',
      'border-top-left-radius',
      'border-top-right-radius',
      'border-top-style',
      'border-top-width',
      'border-width',
      'bottom',
      'box-decoration-break',
      'box-shadow',
      'box-sizing',
      'break-after',
      'break-before',
      'break-inside',
      'caption-side',
      'caret-color',
      'clear',
      'clip',
      'clip-path',
      'clip-rule',
      'color',
      'column-count',
      'column-fill',
      'column-gap',
      'column-rule',
      'column-rule-color',
      'column-rule-style',
      'column-rule-width',
      'column-span',
      'column-width',
      'columns',
      'contain',
      'content',
      'content-visibility',
      'counter-increment',
      'counter-reset',
      'cue',
      'cue-after',
      'cue-before',
      'cursor',
      'direction',
      'display',
      'empty-cells',
      'filter',
      'flex',
      'flex-basis',
      'flex-direction',
      'flex-flow',
      'flex-grow',
      'flex-shrink',
      'flex-wrap',
      'float',
      'flow',
      'font',
      'font-display',
      'font-family',
      'font-feature-settings',
      'font-kerning',
      'font-language-override',
      'font-size',
      'font-size-adjust',
      'font-smoothing',
      'font-stretch',
      'font-style',
      'font-synthesis',
      'font-variant',
      'font-variant-caps',
      'font-variant-east-asian',
      'font-variant-ligatures',
      'font-variant-numeric',
      'font-variant-position',
      'font-variation-settings',
      'font-weight',
      'gap',
      'glyph-orientation-vertical',
      'grid',
      'grid-area',
      'grid-auto-columns',
      'grid-auto-flow',
      'grid-auto-rows',
      'grid-column',
      'grid-column-end',
      'grid-column-start',
      'grid-gap',
      'grid-row',
      'grid-row-end',
      'grid-row-start',
      'grid-template',
      'grid-template-areas',
      'grid-template-columns',
      'grid-template-rows',
      'hanging-punctuation',
      'height',
      'hyphens',
      'icon',
      'image-orientation',
      'image-rendering',
      'image-resolution',
      'ime-mode',
      'inline-size',
      'isolation',
      'justify-content',
      'left',
      'letter-spacing',
      'line-break',
      'line-height',
      'list-style',
      'list-style-image',
      'list-style-position',
      'list-style-type',
      'margin',
      'margin-block',
      'margin-block-end',
      'margin-block-start',
      'margin-bottom',
      'margin-inline',
      'margin-inline-end',
      'margin-inline-start',
      'margin-left',
      'margin-right',
      'margin-top',
      'marks',
      'mask',
      'mask-border',
      'mask-border-mode',
      'mask-border-outset',
      'mask-border-repeat',
      'mask-border-slice',
      'mask-border-source',
      'mask-border-width',
      'mask-clip',
      'mask-composite',
      'mask-image',
      'mask-mode',
      'mask-origin',
      'mask-position',
      'mask-repeat',
      'mask-size',
      'mask-type',
      'max-block-size',
      'max-height',
      'max-inline-size',
      'max-width',
      'min-block-size',
      'min-height',
      'min-inline-size',
      'min-width',
      'mix-blend-mode',
      'nav-down',
      'nav-index',
      'nav-left',
      'nav-right',
      'nav-up',
      'none',
      'normal',
      'object-fit',
      'object-position',
      'opacity',
      'order',
      'orphans',
      'outline',
      'outline-color',
      'outline-offset',
      'outline-style',
      'outline-width',
      'overflow',
      'overflow-wrap',
      'overflow-x',
      'overflow-y',
      'padding',
      'padding-block',
      'padding-block-end',
      'padding-block-start',
      'padding-bottom',
      'padding-inline',
      'padding-inline-end',
      'padding-inline-start',
      'padding-left',
      'padding-right',
      'padding-top',
      'page-break-after',
      'page-break-before',
      'page-break-inside',
      'pause',
      'pause-after',
      'pause-before',
      'perspective',
      'perspective-origin',
      'pointer-events',
      'position',
      'quotes',
      'resize',
      'rest',
      'rest-after',
      'rest-before',
      'right',
      'row-gap',
      'scroll-margin',
      'scroll-margin-block',
      'scroll-margin-block-end',
      'scroll-margin-block-start',
      'scroll-margin-bottom',
      'scroll-margin-inline',
      'scroll-margin-inline-end',
      'scroll-margin-inline-start',
      'scroll-margin-left',
      'scroll-margin-right',
      'scroll-margin-top',
      'scroll-padding',
      'scroll-padding-block',
      'scroll-padding-block-end',
      'scroll-padding-block-start',
      'scroll-padding-bottom',
      'scroll-padding-inline',
      'scroll-padding-inline-end',
      'scroll-padding-inline-start',
      'scroll-padding-left',
      'scroll-padding-right',
      'scroll-padding-top',
      'scroll-snap-align',
      'scroll-snap-stop',
      'scroll-snap-type',
      'scrollbar-color',
      'scrollbar-gutter',
      'scrollbar-width',
      'shape-image-threshold',
      'shape-margin',
      'shape-outside',
      'speak',
      'speak-as',
      'src', // @font-face
      'tab-size',
      'table-layout',
      'text-align',
      'text-align-all',
      'text-align-last',
      'text-combine-upright',
      'text-decoration',
      'text-decoration-color',
      'text-decoration-line',
      'text-decoration-style',
      'text-emphasis',
      'text-emphasis-color',
      'text-emphasis-position',
      'text-emphasis-style',
      'text-indent',
      'text-justify',
      'text-orientation',
      'text-overflow',
      'text-rendering',
      'text-shadow',
      'text-transform',
      'text-underline-position',
      'top',
      'transform',
      'transform-box',
      'transform-origin',
      'transform-style',
      'transition',
      'transition-delay',
      'transition-duration',
      'transition-property',
      'transition-timing-function',
      'unicode-bidi',
      'vertical-align',
      'visibility',
      'voice-balance',
      'voice-duration',
      'voice-family',
      'voice-pitch',
      'voice-range',
      'voice-rate',
      'voice-stress',
      'voice-volume',
      'white-space',
      'widows',
      'width',
      'will-change',
      'word-break',
      'word-spacing',
      'word-wrap',
      'writing-mode',
      'z-index'
      // reverse makes sure longer attributes `font-weight` are matched fully
      // instead of getting false positives on say `font`
    ].reverse();

    /*
    Language: CSS
    Category: common, css, web
    Website: https://developer.mozilla.org/en-US/docs/Web/CSS
    */

    /** @type LanguageFn */
    function css(hljs) {
      const regex = hljs.regex;
      const modes = MODES(hljs);
      const VENDOR_PREFIX = { begin: /-(webkit|moz|ms|o)-(?=[a-z])/ };
      const AT_MODIFIERS = "and or not only";
      const AT_PROPERTY_RE = /@-?\w[\w]*(-\w+)*/; // @-webkit-keyframes
      const IDENT_RE = '[a-zA-Z-][a-zA-Z0-9_-]*';
      const STRINGS = [
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE
      ];

      return {
        name: 'CSS',
        case_insensitive: true,
        illegal: /[=|'\$]/,
        keywords: { keyframePosition: "from to" },
        classNameAliases: {
          // for visual continuity with `tag {}` and because we
          // don't have a great class for this?
          keyframePosition: "selector-tag" },
        contains: [
          modes.BLOCK_COMMENT,
          VENDOR_PREFIX,
          // to recognize keyframe 40% etc which are outside the scope of our
          // attribute value mode
          modes.CSS_NUMBER_MODE,
          {
            className: 'selector-id',
            begin: /#[A-Za-z0-9_-]+/,
            relevance: 0
          },
          {
            className: 'selector-class',
            begin: '\\.' + IDENT_RE,
            relevance: 0
          },
          modes.ATTRIBUTE_SELECTOR_MODE,
          {
            className: 'selector-pseudo',
            variants: [
              { begin: ':(' + PSEUDO_CLASSES.join('|') + ')' },
              { begin: ':(:)?(' + PSEUDO_ELEMENTS.join('|') + ')' }
            ]
          },
          // we may actually need this (12/2020)
          // { // pseudo-selector params
          //   begin: /\(/,
          //   end: /\)/,
          //   contains: [ hljs.CSS_NUMBER_MODE ]
          // },
          modes.CSS_VARIABLE,
          {
            className: 'attribute',
            begin: '\\b(' + ATTRIBUTES.join('|') + ')\\b'
          },
          // attribute values
          {
            begin: /:/,
            end: /[;}{]/,
            contains: [
              modes.BLOCK_COMMENT,
              modes.HEXCOLOR,
              modes.IMPORTANT,
              modes.CSS_NUMBER_MODE,
              ...STRINGS,
              // needed to highlight these as strings and to avoid issues with
              // illegal characters that might be inside urls that would tigger the
              // languages illegal stack
              {
                begin: /(url|data-uri)\(/,
                end: /\)/,
                relevance: 0, // from keywords
                keywords: { built_in: "url data-uri" },
                contains: [
                  ...STRINGS,
                  {
                    className: "string",
                    // any character other than `)` as in `url()` will be the start
                    // of a string, which ends with `)` (from the parent mode)
                    begin: /[^)]/,
                    endsWithParent: true,
                    excludeEnd: true
                  }
                ]
              },
              modes.FUNCTION_DISPATCH
            ]
          },
          {
            begin: regex.lookahead(/@/),
            end: '[{;]',
            relevance: 0,
            illegal: /:/, // break on Less variables @var: ...
            contains: [
              {
                className: 'keyword',
                begin: AT_PROPERTY_RE
              },
              {
                begin: /\s/,
                endsWithParent: true,
                excludeEnd: true,
                relevance: 0,
                keywords: {
                  $pattern: /[a-z-]+/,
                  keyword: AT_MODIFIERS,
                  attribute: MEDIA_FEATURES.join(" ")
                },
                contains: [
                  {
                    begin: /[a-z-]+(?=:)/,
                    className: "attribute"
                  },
                  ...STRINGS,
                  modes.CSS_NUMBER_MODE
                ]
              }
            ]
          },
          {
            className: 'selector-tag',
            begin: '\\b(' + TAGS.join('|') + ')\\b'
          }
        ]
      };
    }

    /*
    Language: D
    Author: Aleksandar Ruzicic <aleksandar@ruzicic.info>
    Description: D is a language with C-like syntax and static typing. It pragmatically combines efficiency, control, and modeling power, with safety and programmer productivity.
    Version: 1.0a
    Website: https://dlang.org
    Date: 2012-04-08
    */

    /**
     * Known issues:
     *
     * - invalid hex string literals will be recognized as a double quoted strings
     *   but 'x' at the beginning of string will not be matched
     *
     * - delimited string literals are not checked for matching end delimiter
     *   (not possible to do with js regexp)
     *
     * - content of token string is colored as a string (i.e. no keyword coloring inside a token string)
     *   also, content of token string is not validated to contain only valid D tokens
     *
     * - special token sequence rule is not strictly following D grammar (anything following #line
     *   up to the end of line is matched as special token sequence)
     */

    /** @type LanguageFn */
    function d(hljs) {
      /**
       * Language keywords
       *
       * @type {Object}
       */
      const D_KEYWORDS = {
        $pattern: hljs.UNDERSCORE_IDENT_RE,
        keyword:
          'abstract alias align asm assert auto body break byte case cast catch class '
          + 'const continue debug default delete deprecated do else enum export extern final '
          + 'finally for foreach foreach_reverse|10 goto if immutable import in inout int '
          + 'interface invariant is lazy macro mixin module new nothrow out override package '
          + 'pragma private protected public pure ref return scope shared static struct '
          + 'super switch synchronized template this throw try typedef typeid typeof union '
          + 'unittest version void volatile while with __FILE__ __LINE__ __gshared|10 '
          + '__thread __traits __DATE__ __EOF__ __TIME__ __TIMESTAMP__ __VENDOR__ __VERSION__',
        built_in:
          'bool cdouble cent cfloat char creal dchar delegate double dstring float function '
          + 'idouble ifloat ireal long real short string ubyte ucent uint ulong ushort wchar '
          + 'wstring',
        literal:
          'false null true'
      };

      /**
       * Number literal regexps
       *
       * @type {String}
       */
      const decimal_integer_re = '(0|[1-9][\\d_]*)';
      const decimal_integer_nosus_re = '(0|[1-9][\\d_]*|\\d[\\d_]*|[\\d_]+?\\d)';
      const binary_integer_re = '0[bB][01_]+';
      const hexadecimal_digits_re = '([\\da-fA-F][\\da-fA-F_]*|_[\\da-fA-F][\\da-fA-F_]*)';
      const hexadecimal_integer_re = '0[xX]' + hexadecimal_digits_re;

      const decimal_exponent_re = '([eE][+-]?' + decimal_integer_nosus_re + ')';
      const decimal_float_re = '(' + decimal_integer_nosus_re + '(\\.\\d*|' + decimal_exponent_re + ')|'
                    + '\\d+\\.' + decimal_integer_nosus_re + '|'
                    + '\\.' + decimal_integer_re + decimal_exponent_re + '?'
                  + ')';
      const hexadecimal_float_re = '(0[xX]('
                      + hexadecimal_digits_re + '\\.' + hexadecimal_digits_re + '|'
                      + '\\.?' + hexadecimal_digits_re
                     + ')[pP][+-]?' + decimal_integer_nosus_re + ')';

      const integer_re = '('
          + decimal_integer_re + '|'
          + binary_integer_re + '|'
           + hexadecimal_integer_re
        + ')';

      const float_re = '('
          + hexadecimal_float_re + '|'
          + decimal_float_re
        + ')';

      /**
       * Escape sequence supported in D string and character literals
       *
       * @type {String}
       */
      const escape_sequence_re = '\\\\('
                  + '[\'"\\?\\\\abfnrtv]|' // common escapes
                  + 'u[\\dA-Fa-f]{4}|' // four hex digit unicode codepoint
                  + '[0-7]{1,3}|' // one to three octal digit ascii char code
                  + 'x[\\dA-Fa-f]{2}|' // two hex digit ascii char code
                  + 'U[\\dA-Fa-f]{8}' // eight hex digit unicode codepoint
                  + ')|'
                  + '&[a-zA-Z\\d]{2,};'; // named character entity

      /**
       * D integer number literals
       *
       * @type {Object}
       */
      const D_INTEGER_MODE = {
        className: 'number',
        begin: '\\b' + integer_re + '(L|u|U|Lu|LU|uL|UL)?',
        relevance: 0
      };

      /**
       * [D_FLOAT_MODE description]
       * @type {Object}
       */
      const D_FLOAT_MODE = {
        className: 'number',
        begin: '\\b('
            + float_re + '([fF]|L|i|[fF]i|Li)?|'
            + integer_re + '(i|[fF]i|Li)'
          + ')',
        relevance: 0
      };

      /**
       * D character literal
       *
       * @type {Object}
       */
      const D_CHARACTER_MODE = {
        className: 'string',
        begin: '\'(' + escape_sequence_re + '|.)',
        end: '\'',
        illegal: '.'
      };

      /**
       * D string escape sequence
       *
       * @type {Object}
       */
      const D_ESCAPE_SEQUENCE = {
        begin: escape_sequence_re,
        relevance: 0
      };

      /**
       * D double quoted string literal
       *
       * @type {Object}
       */
      const D_STRING_MODE = {
        className: 'string',
        begin: '"',
        contains: [ D_ESCAPE_SEQUENCE ],
        end: '"[cwd]?'
      };

      /**
       * D wysiwyg and delimited string literals
       *
       * @type {Object}
       */
      const D_WYSIWYG_DELIMITED_STRING_MODE = {
        className: 'string',
        begin: '[rq]"',
        end: '"[cwd]?',
        relevance: 5
      };

      /**
       * D alternate wysiwyg string literal
       *
       * @type {Object}
       */
      const D_ALTERNATE_WYSIWYG_STRING_MODE = {
        className: 'string',
        begin: '`',
        end: '`[cwd]?'
      };

      /**
       * D hexadecimal string literal
       *
       * @type {Object}
       */
      const D_HEX_STRING_MODE = {
        className: 'string',
        begin: 'x"[\\da-fA-F\\s\\n\\r]*"[cwd]?',
        relevance: 10
      };

      /**
       * D delimited string literal
       *
       * @type {Object}
       */
      const D_TOKEN_STRING_MODE = {
        className: 'string',
        begin: 'q"\\{',
        end: '\\}"'
      };

      /**
       * Hashbang support
       *
       * @type {Object}
       */
      const D_HASHBANG_MODE = {
        className: 'meta',
        begin: '^#!',
        end: '$',
        relevance: 5
      };

      /**
       * D special token sequence
       *
       * @type {Object}
       */
      const D_SPECIAL_TOKEN_SEQUENCE_MODE = {
        className: 'meta',
        begin: '#(line)',
        end: '$',
        relevance: 5
      };

      /**
       * D attributes
       *
       * @type {Object}
       */
      const D_ATTRIBUTE_MODE = {
        className: 'keyword',
        begin: '@[a-zA-Z_][a-zA-Z_\\d]*'
      };

      /**
       * D nesting comment
       *
       * @type {Object}
       */
      const D_NESTING_COMMENT_MODE = hljs.COMMENT(
        '\\/\\+',
        '\\+\\/',
        {
          contains: [ 'self' ],
          relevance: 10
        }
      );

      return {
        name: 'D',
        keywords: D_KEYWORDS,
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          D_NESTING_COMMENT_MODE,
          D_HEX_STRING_MODE,
          D_STRING_MODE,
          D_WYSIWYG_DELIMITED_STRING_MODE,
          D_ALTERNATE_WYSIWYG_STRING_MODE,
          D_TOKEN_STRING_MODE,
          D_FLOAT_MODE,
          D_INTEGER_MODE,
          D_CHARACTER_MODE,
          D_HASHBANG_MODE,
          D_SPECIAL_TOKEN_SEQUENCE_MODE,
          D_ATTRIBUTE_MODE
        ]
      };
    }

    /*
    Language: HTML, XML
    Website: https://www.w3.org/XML/
    Category: common, web
    Audit: 2020
    */

    /** @type LanguageFn */
    function xml(hljs) {
      const regex = hljs.regex;
      // XML names can have the following additional letters: https://www.w3.org/TR/xml/#NT-NameChar
      // OTHER_NAME_CHARS = /[:\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]/;
      // Element names start with NAME_START_CHAR followed by optional other Unicode letters, ASCII digits, hyphens, underscores, and periods
      // const TAG_NAME_RE = regex.concat(/[A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/, regex.optional(/[A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*:/), /[A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*/);;
      // const XML_IDENT_RE = /[A-Z_a-z:\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]+/;
      // const TAG_NAME_RE = regex.concat(/[A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/, regex.optional(/[A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*:/), /[A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*/);
      // however, to cater for performance and more Unicode support rely simply on the Unicode letter class
      const TAG_NAME_RE = regex.concat(/[\p{L}_]/u, regex.optional(/[\p{L}0-9_.-]*:/u), /[\p{L}0-9_.-]*/u);
      const XML_IDENT_RE = /[\p{L}0-9._:-]+/u;
      const XML_ENTITIES = {
        className: 'symbol',
        begin: /&[a-z]+;|&#[0-9]+;|&#x[a-f0-9]+;/
      };
      const XML_META_KEYWORDS = {
        begin: /\s/,
        contains: [
          {
            className: 'keyword',
            begin: /#?[a-z_][a-z1-9_-]+/,
            illegal: /\n/
          }
        ]
      };
      const XML_META_PAR_KEYWORDS = hljs.inherit(XML_META_KEYWORDS, {
        begin: /\(/,
        end: /\)/
      });
      const APOS_META_STRING_MODE = hljs.inherit(hljs.APOS_STRING_MODE, { className: 'string' });
      const QUOTE_META_STRING_MODE = hljs.inherit(hljs.QUOTE_STRING_MODE, { className: 'string' });
      const TAG_INTERNALS = {
        endsWithParent: true,
        illegal: /</,
        relevance: 0,
        contains: [
          {
            className: 'attr',
            begin: XML_IDENT_RE,
            relevance: 0
          },
          {
            begin: /=\s*/,
            relevance: 0,
            contains: [
              {
                className: 'string',
                endsParent: true,
                variants: [
                  {
                    begin: /"/,
                    end: /"/,
                    contains: [ XML_ENTITIES ]
                  },
                  {
                    begin: /'/,
                    end: /'/,
                    contains: [ XML_ENTITIES ]
                  },
                  { begin: /[^\s"'=<>`]+/ }
                ]
              }
            ]
          }
        ]
      };
      return {
        name: 'HTML, XML',
        aliases: [
          'html',
          'xhtml',
          'rss',
          'atom',
          'xjb',
          'xsd',
          'xsl',
          'plist',
          'wsf',
          'svg'
        ],
        case_insensitive: true,
        unicodeRegex: true,
        contains: [
          {
            className: 'meta',
            begin: /<![a-z]/,
            end: />/,
            relevance: 10,
            contains: [
              XML_META_KEYWORDS,
              QUOTE_META_STRING_MODE,
              APOS_META_STRING_MODE,
              XML_META_PAR_KEYWORDS,
              {
                begin: /\[/,
                end: /\]/,
                contains: [
                  {
                    className: 'meta',
                    begin: /<![a-z]/,
                    end: />/,
                    contains: [
                      XML_META_KEYWORDS,
                      XML_META_PAR_KEYWORDS,
                      QUOTE_META_STRING_MODE,
                      APOS_META_STRING_MODE
                    ]
                  }
                ]
              }
            ]
          },
          hljs.COMMENT(
            /<!--/,
            /-->/,
            { relevance: 10 }
          ),
          {
            begin: /<!\[CDATA\[/,
            end: /\]\]>/,
            relevance: 10
          },
          XML_ENTITIES,
          // xml processing instructions
          {
            className: 'meta',
            end: /\?>/,
            variants: [
              {
                begin: /<\?xml/,
                relevance: 10,
                contains: [
                  QUOTE_META_STRING_MODE
                ]
              },
              {
                begin: /<\?[a-z][a-z0-9]+/,
              }
            ]

          },
          {
            className: 'tag',
            /*
            The lookahead pattern (?=...) ensures that 'begin' only matches
            '<style' as a single word, followed by a whitespace or an
            ending bracket.
            */
            begin: /<style(?=\s|>)/,
            end: />/,
            keywords: { name: 'style' },
            contains: [ TAG_INTERNALS ],
            starts: {
              end: /<\/style>/,
              returnEnd: true,
              subLanguage: [
                'css',
                'xml'
              ]
            }
          },
          {
            className: 'tag',
            // See the comment in the <style tag about the lookahead pattern
            begin: /<script(?=\s|>)/,
            end: />/,
            keywords: { name: 'script' },
            contains: [ TAG_INTERNALS ],
            starts: {
              end: /<\/script>/,
              returnEnd: true,
              subLanguage: [
                'javascript',
                'handlebars',
                'xml'
              ]
            }
          },
          // we need this for now for jSX
          {
            className: 'tag',
            begin: /<>|<\/>/
          },
          // open tag
          {
            className: 'tag',
            begin: regex.concat(
              /</,
              regex.lookahead(regex.concat(
                TAG_NAME_RE,
                // <tag/>
                // <tag>
                // <tag ...
                regex.either(/\/>/, />/, /\s/)
              ))
            ),
            end: /\/?>/,
            contains: [
              {
                className: 'name',
                begin: TAG_NAME_RE,
                relevance: 0,
                starts: TAG_INTERNALS
              }
            ]
          },
          // close tag
          {
            className: 'tag',
            begin: regex.concat(
              /<\//,
              regex.lookahead(regex.concat(
                TAG_NAME_RE, />/
              ))
            ),
            contains: [
              {
                className: 'name',
                begin: TAG_NAME_RE,
                relevance: 0
              },
              {
                begin: />/,
                relevance: 0,
                endsParent: true
              }
            ]
          }
        ]
      };
    }

    /*
    Language: Markdown
    Requires: xml.js
    Author: John Crepezzi <john.crepezzi@gmail.com>
    Website: https://daringfireball.net/projects/markdown/
    Category: common, markup
    */

    function markdown(hljs) {
      const regex = hljs.regex;
      const INLINE_HTML = {
        begin: /<\/?[A-Za-z_]/,
        end: '>',
        subLanguage: 'xml',
        relevance: 0
      };
      const HORIZONTAL_RULE = {
        begin: '^[-\\*]{3,}',
        end: '$'
      };
      const CODE = {
        className: 'code',
        variants: [
          // TODO: fix to allow these to work with sublanguage also
          { begin: '(`{3,})[^`](.|\\n)*?\\1`*[ ]*' },
          { begin: '(~{3,})[^~](.|\\n)*?\\1~*[ ]*' },
          // needed to allow markdown as a sublanguage to work
          {
            begin: '```',
            end: '```+[ ]*$'
          },
          {
            begin: '~~~',
            end: '~~~+[ ]*$'
          },
          { begin: '`.+?`' },
          {
            begin: '(?=^( {4}|\\t))',
            // use contains to gobble up multiple lines to allow the block to be whatever size
            // but only have a single open/close tag vs one per line
            contains: [
              {
                begin: '^( {4}|\\t)',
                end: '(\\n)$'
              }
            ],
            relevance: 0
          }
        ]
      };
      const LIST = {
        className: 'bullet',
        begin: '^[ \t]*([*+-]|(\\d+\\.))(?=\\s+)',
        end: '\\s+',
        excludeEnd: true
      };
      const LINK_REFERENCE = {
        begin: /^\[[^\n]+\]:/,
        returnBegin: true,
        contains: [
          {
            className: 'symbol',
            begin: /\[/,
            end: /\]/,
            excludeBegin: true,
            excludeEnd: true
          },
          {
            className: 'link',
            begin: /:\s*/,
            end: /$/,
            excludeBegin: true
          }
        ]
      };
      const URL_SCHEME = /[A-Za-z][A-Za-z0-9+.-]*/;
      const LINK = {
        variants: [
          // too much like nested array access in so many languages
          // to have any real relevance
          {
            begin: /\[.+?\]\[.*?\]/,
            relevance: 0
          },
          // popular internet URLs
          {
            begin: /\[.+?\]\(((data|javascript|mailto):|(?:http|ftp)s?:\/\/).*?\)/,
            relevance: 2
          },
          {
            begin: regex.concat(/\[.+?\]\(/, URL_SCHEME, /:\/\/.*?\)/),
            relevance: 2
          },
          // relative urls
          {
            begin: /\[.+?\]\([./?&#].*?\)/,
            relevance: 1
          },
          // whatever else, lower relevance (might not be a link at all)
          {
            begin: /\[.*?\]\(.*?\)/,
            relevance: 0
          }
        ],
        returnBegin: true,
        contains: [
          {
            // empty strings for alt or link text
            match: /\[(?=\])/ },
          {
            className: 'string',
            relevance: 0,
            begin: '\\[',
            end: '\\]',
            excludeBegin: true,
            returnEnd: true
          },
          {
            className: 'link',
            relevance: 0,
            begin: '\\]\\(',
            end: '\\)',
            excludeBegin: true,
            excludeEnd: true
          },
          {
            className: 'symbol',
            relevance: 0,
            begin: '\\]\\[',
            end: '\\]',
            excludeBegin: true,
            excludeEnd: true
          }
        ]
      };
      const BOLD = {
        className: 'strong',
        contains: [], // defined later
        variants: [
          {
            begin: /_{2}(?!\s)/,
            end: /_{2}/
          },
          {
            begin: /\*{2}(?!\s)/,
            end: /\*{2}/
          }
        ]
      };
      const ITALIC = {
        className: 'emphasis',
        contains: [], // defined later
        variants: [
          {
            begin: /\*(?![*\s])/,
            end: /\*/
          },
          {
            begin: /_(?![_\s])/,
            end: /_/,
            relevance: 0
          }
        ]
      };

      // 3 level deep nesting is not allowed because it would create confusion
      // in cases like `***testing***` because where we don't know if the last
      // `***` is starting a new bold/italic or finishing the last one
      const BOLD_WITHOUT_ITALIC = hljs.inherit(BOLD, { contains: [] });
      const ITALIC_WITHOUT_BOLD = hljs.inherit(ITALIC, { contains: [] });
      BOLD.contains.push(ITALIC_WITHOUT_BOLD);
      ITALIC.contains.push(BOLD_WITHOUT_ITALIC);

      let CONTAINABLE = [
        INLINE_HTML,
        LINK
      ];

      [
        BOLD,
        ITALIC,
        BOLD_WITHOUT_ITALIC,
        ITALIC_WITHOUT_BOLD
      ].forEach(m => {
        m.contains = m.contains.concat(CONTAINABLE);
      });

      CONTAINABLE = CONTAINABLE.concat(BOLD, ITALIC);

      const HEADER = {
        className: 'section',
        variants: [
          {
            begin: '^#{1,6}',
            end: '$',
            contains: CONTAINABLE
          },
          {
            begin: '(?=^.+?\\n[=-]{2,}$)',
            contains: [
              { begin: '^[=-]*$' },
              {
                begin: '^',
                end: "\\n",
                contains: CONTAINABLE
              }
            ]
          }
        ]
      };

      const BLOCKQUOTE = {
        className: 'quote',
        begin: '^>\\s+',
        contains: CONTAINABLE,
        end: '$'
      };

      return {
        name: 'Markdown',
        aliases: [
          'md',
          'mkdown',
          'mkd'
        ],
        contains: [
          HEADER,
          INLINE_HTML,
          LIST,
          BOLD,
          ITALIC,
          BLOCKQUOTE,
          CODE,
          HORIZONTAL_RULE,
          LINK,
          LINK_REFERENCE
        ]
      };
    }

    /*
    Language: Dart
    Requires: markdown.js
    Author: Maxim Dikun <dikmax@gmail.com>
    Description: Dart a modern, object-oriented language developed by Google. For more information see https://www.dartlang.org/
    Website: https://dart.dev
    Category: scripting
    */

    /** @type LanguageFn */
    function dart(hljs) {
      const SUBST = {
        className: 'subst',
        variants: [ { begin: '\\$[A-Za-z0-9_]+' } ]
      };

      const BRACED_SUBST = {
        className: 'subst',
        variants: [
          {
            begin: /\$\{/,
            end: /\}/
          }
        ],
        keywords: 'true false null this is new super'
      };

      const STRING = {
        className: 'string',
        variants: [
          {
            begin: 'r\'\'\'',
            end: '\'\'\''
          },
          {
            begin: 'r"""',
            end: '"""'
          },
          {
            begin: 'r\'',
            end: '\'',
            illegal: '\\n'
          },
          {
            begin: 'r"',
            end: '"',
            illegal: '\\n'
          },
          {
            begin: '\'\'\'',
            end: '\'\'\'',
            contains: [
              hljs.BACKSLASH_ESCAPE,
              SUBST,
              BRACED_SUBST
            ]
          },
          {
            begin: '"""',
            end: '"""',
            contains: [
              hljs.BACKSLASH_ESCAPE,
              SUBST,
              BRACED_SUBST
            ]
          },
          {
            begin: '\'',
            end: '\'',
            illegal: '\\n',
            contains: [
              hljs.BACKSLASH_ESCAPE,
              SUBST,
              BRACED_SUBST
            ]
          },
          {
            begin: '"',
            end: '"',
            illegal: '\\n',
            contains: [
              hljs.BACKSLASH_ESCAPE,
              SUBST,
              BRACED_SUBST
            ]
          }
        ]
      };
      BRACED_SUBST.contains = [
        hljs.C_NUMBER_MODE,
        STRING
      ];

      const BUILT_IN_TYPES = [
        // dart:core
        'Comparable',
        'DateTime',
        'Duration',
        'Function',
        'Iterable',
        'Iterator',
        'List',
        'Map',
        'Match',
        'Object',
        'Pattern',
        'RegExp',
        'Set',
        'Stopwatch',
        'String',
        'StringBuffer',
        'StringSink',
        'Symbol',
        'Type',
        'Uri',
        'bool',
        'double',
        'int',
        'num',
        // dart:html
        'Element',
        'ElementList'
      ];
      const NULLABLE_BUILT_IN_TYPES = BUILT_IN_TYPES.map((e) => `${e}?`);

      const BASIC_KEYWORDS = [
        "abstract",
        "as",
        "assert",
        "async",
        "await",
        "break",
        "case",
        "catch",
        "class",
        "const",
        "continue",
        "covariant",
        "default",
        "deferred",
        "do",
        "dynamic",
        "else",
        "enum",
        "export",
        "extends",
        "extension",
        "external",
        "factory",
        "false",
        "final",
        "finally",
        "for",
        "Function",
        "get",
        "hide",
        "if",
        "implements",
        "import",
        "in",
        "inferface",
        "is",
        "late",
        "library",
        "mixin",
        "new",
        "null",
        "on",
        "operator",
        "part",
        "required",
        "rethrow",
        "return",
        "set",
        "show",
        "static",
        "super",
        "switch",
        "sync",
        "this",
        "throw",
        "true",
        "try",
        "typedef",
        "var",
        "void",
        "while",
        "with",
        "yield"
      ];

      const KEYWORDS = {
        keyword: BASIC_KEYWORDS,
        built_in:
          BUILT_IN_TYPES
            .concat(NULLABLE_BUILT_IN_TYPES)
            .concat([
              // dart:core
              'Never',
              'Null',
              'dynamic',
              'print',
              // dart:html
              'document',
              'querySelector',
              'querySelectorAll',
              'window'
            ]),
        $pattern: /[A-Za-z][A-Za-z0-9_]*\??/
      };

      return {
        name: 'Dart',
        keywords: KEYWORDS,
        contains: [
          STRING,
          hljs.COMMENT(
            /\/\*\*(?!\/)/,
            /\*\//,
            {
              subLanguage: 'markdown',
              relevance: 0
            }
          ),
          hljs.COMMENT(
            /\/{3,} ?/,
            /$/, { contains: [
              {
                subLanguage: 'markdown',
                begin: '.',
                end: '$',
                relevance: 0
              }
            ] }
          ),
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          {
            className: 'class',
            beginKeywords: 'class interface',
            end: /\{/,
            excludeEnd: true,
            contains: [
              { beginKeywords: 'extends implements' },
              hljs.UNDERSCORE_TITLE_MODE
            ]
          },
          hljs.C_NUMBER_MODE,
          {
            className: 'meta',
            begin: '@[A-Za-z]+'
          },
          { begin: '=>' // No markup, just a relevance booster
          }
        ]
      };
    }

    /*
    Language: Diff
    Description: Unified and context diff
    Author: Vasily Polovnyov <vast@whiteants.net>
    Website: https://www.gnu.org/software/diffutils/
    Category: common
    */

    /** @type LanguageFn */
    function diff(hljs) {
      const regex = hljs.regex;
      return {
        name: 'Diff',
        aliases: [ 'patch' ],
        contains: [
          {
            className: 'meta',
            relevance: 10,
            match: regex.either(
              /^@@ +-\d+,\d+ +\+\d+,\d+ +@@/,
              /^\*\*\* +\d+,\d+ +\*\*\*\*$/,
              /^--- +\d+,\d+ +----$/
            )
          },
          {
            className: 'comment',
            variants: [
              {
                begin: regex.either(
                  /Index: /,
                  /^index/,
                  /={3,}/,
                  /^-{3}/,
                  /^\*{3} /,
                  /^\+{3}/,
                  /^diff --git/
                ),
                end: /$/
              },
              { match: /^\*{15}$/ }
            ]
          },
          {
            className: 'addition',
            begin: /^\+/,
            end: /$/
          },
          {
            className: 'deletion',
            begin: /^-/,
            end: /$/
          },
          {
            className: 'addition',
            begin: /^!/,
            end: /$/
          }
        ]
      };
    }

    /*
    Language: Dust
    Requires: xml.js
    Author: Michael Allen <michael.allen@benefitfocus.com>
    Description: Matcher for dust.js templates.
    Website: https://www.dustjs.com
    Category: template
    */

    /** @type LanguageFn */
    function dust(hljs) {
      const EXPRESSION_KEYWORDS = 'if eq ne lt lte gt gte select default math sep';
      return {
        name: 'Dust',
        aliases: [ 'dst' ],
        case_insensitive: true,
        subLanguage: 'xml',
        contains: [
          {
            className: 'template-tag',
            begin: /\{[#\/]/,
            end: /\}/,
            illegal: /;/,
            contains: [
              {
                className: 'name',
                begin: /[a-zA-Z\.-]+/,
                starts: {
                  endsWithParent: true,
                  relevance: 0,
                  contains: [ hljs.QUOTE_STRING_MODE ]
                }
              }
            ]
          },
          {
            className: 'template-variable',
            begin: /\{/,
            end: /\}/,
            illegal: /;/,
            keywords: EXPRESSION_KEYWORDS
          }
        ]
      };
    }

    /*
    Language: Extended Backus-Naur Form
    Author: Alex McKibben <alex@nullscope.net>
    Website: https://en.wikipedia.org/wiki/Extended_Backus–Naur_form
    */

    /** @type LanguageFn */
    function ebnf(hljs) {
      const commentMode = hljs.COMMENT(/\(\*/, /\*\)/);

      const nonTerminalMode = {
        className: "attribute",
        begin: /^[ ]*[a-zA-Z]+([\s_-]+[a-zA-Z]+)*/
      };

      const specialSequenceMode = {
        className: "meta",
        begin: /\?.*\?/
      };

      const ruleBodyMode = {
        begin: /=/,
        end: /[.;]/,
        contains: [
          commentMode,
          specialSequenceMode,
          {
            // terminals
            className: 'string',
            variants: [
              hljs.APOS_STRING_MODE,
              hljs.QUOTE_STRING_MODE,
              {
                begin: '`',
                end: '`'
              }
            ]
          }
        ]
      };

      return {
        name: 'Extended Backus-Naur Form',
        illegal: /\S/,
        contains: [
          commentMode,
          nonTerminalMode,
          ruleBodyMode
        ]
      };
    }

    /*
    Language: Elixir
    Author: Josh Adams <josh@isotope11.com>
    Description: language definition for Elixir source code files (.ex and .exs).  Based on ruby language support.
    Category: functional
    Website: https://elixir-lang.org
    */

    /** @type LanguageFn */
    function elixir(hljs) {
      const regex = hljs.regex;
      const ELIXIR_IDENT_RE = '[a-zA-Z_][a-zA-Z0-9_.]*(!|\\?)?';
      const ELIXIR_METHOD_RE = '[a-zA-Z_]\\w*[!?=]?|[-+~]@|<<|>>|=~|===?|<=>|[<>]=?|\\*\\*|[-/+%^&*~`|]|\\[\\]=?';
      const KEYWORDS = [
        "after",
        "alias",
        "and",
        "case",
        "catch",
        "cond",
        "defstruct",
        "defguard",
        "do",
        "else",
        "end",
        "fn",
        "for",
        "if",
        "import",
        "in",
        "not",
        "or",
        "quote",
        "raise",
        "receive",
        "require",
        "reraise",
        "rescue",
        "try",
        "unless",
        "unquote",
        "unquote_splicing",
        "use",
        "when",
        "with|0"
      ];
      const LITERALS = [
        "false",
        "nil",
        "true"
      ];
      const KWS = {
        $pattern: ELIXIR_IDENT_RE,
        keyword: KEYWORDS,
        literal: LITERALS
      };
      const SUBST = {
        className: 'subst',
        begin: /#\{/,
        end: /\}/,
        keywords: KWS
      };
      const NUMBER = {
        className: 'number',
        begin: '(\\b0o[0-7_]+)|(\\b0b[01_]+)|(\\b0x[0-9a-fA-F_]+)|(-?\\b[0-9][0-9_]*(\\.[0-9_]+([eE][-+]?[0-9]+)?)?)',
        relevance: 0
      };
      // TODO: could be tightened
      // https://elixir-lang.readthedocs.io/en/latest/intro/18.html
      // but you also need to include closing delemeters in the escape list per
      // individual sigil mode from what I can tell,
      // ie: \} might or might not be an escape depending on the sigil used
      const ESCAPES_RE = /\\[\s\S]/;
      // const ESCAPES_RE = /\\["'\\abdefnrstv0]/;
      const BACKSLASH_ESCAPE = {
        match: ESCAPES_RE,
        scope: "char.escape",
        relevance: 0
      };
      const SIGIL_DELIMITERS = '[/|([{<"\']';
      const SIGIL_DELIMITER_MODES = [
        {
          begin: /"/,
          end: /"/
        },
        {
          begin: /'/,
          end: /'/
        },
        {
          begin: /\//,
          end: /\//
        },
        {
          begin: /\|/,
          end: /\|/
        },
        {
          begin: /\(/,
          end: /\)/
        },
        {
          begin: /\[/,
          end: /\]/
        },
        {
          begin: /\{/,
          end: /\}/
        },
        {
          begin: /</,
          end: />/
        }
      ];
      const escapeSigilEnd = (end) => {
        return {
          scope: "char.escape",
          begin: regex.concat(/\\/, end),
          relevance: 0
        };
      };
      const LOWERCASE_SIGIL = {
        className: 'string',
        begin: '~[a-z]' + '(?=' + SIGIL_DELIMITERS + ')',
        contains: SIGIL_DELIMITER_MODES.map(x => hljs.inherit(x,
          { contains: [
            escapeSigilEnd(x.end),
            BACKSLASH_ESCAPE,
            SUBST
          ] }
        ))
      };

      const UPCASE_SIGIL = {
        className: 'string',
        begin: '~[A-Z]' + '(?=' + SIGIL_DELIMITERS + ')',
        contains: SIGIL_DELIMITER_MODES.map(x => hljs.inherit(x,
          { contains: [ escapeSigilEnd(x.end) ] }
        ))
      };

      const REGEX_SIGIL = {
        className: 'regex',
        variants: [
          {
            begin: '~r' + '(?=' + SIGIL_DELIMITERS + ')',
            contains: SIGIL_DELIMITER_MODES.map(x => hljs.inherit(x,
              {
                end: regex.concat(x.end, /[uismxfU]{0,7}/),
                contains: [
                  escapeSigilEnd(x.end),
                  BACKSLASH_ESCAPE,
                  SUBST
                ]
              }
            ))
          },
          {
            begin: '~R' + '(?=' + SIGIL_DELIMITERS + ')',
            contains: SIGIL_DELIMITER_MODES.map(x => hljs.inherit(x,
              {
                end: regex.concat(x.end, /[uismxfU]{0,7}/),
                contains: [ escapeSigilEnd(x.end) ]
              })
            )
          }
        ]
      };

      const STRING = {
        className: 'string',
        contains: [
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ],
        variants: [
          {
            begin: /"""/,
            end: /"""/
          },
          {
            begin: /'''/,
            end: /'''/
          },
          {
            begin: /~S"""/,
            end: /"""/,
            contains: [] // override default
          },
          {
            begin: /~S"/,
            end: /"/,
            contains: [] // override default
          },
          {
            begin: /~S'''/,
            end: /'''/,
            contains: [] // override default
          },
          {
            begin: /~S'/,
            end: /'/,
            contains: [] // override default
          },
          {
            begin: /'/,
            end: /'/
          },
          {
            begin: /"/,
            end: /"/
          }
        ]
      };
      const FUNCTION = {
        className: 'function',
        beginKeywords: 'def defp defmacro defmacrop',
        end: /\B\b/, // the mode is ended by the title
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {
            begin: ELIXIR_IDENT_RE,
            endsParent: true
          })
        ]
      };
      const CLASS = hljs.inherit(FUNCTION, {
        className: 'class',
        beginKeywords: 'defimpl defmodule defprotocol defrecord',
        end: /\bdo\b|$|;/
      });
      const ELIXIR_DEFAULT_CONTAINS = [
        STRING,
        REGEX_SIGIL,
        UPCASE_SIGIL,
        LOWERCASE_SIGIL,
        hljs.HASH_COMMENT_MODE,
        CLASS,
        FUNCTION,
        { begin: '::' },
        {
          className: 'symbol',
          begin: ':(?![\\s:])',
          contains: [
            STRING,
            { begin: ELIXIR_METHOD_RE }
          ],
          relevance: 0
        },
        {
          className: 'symbol',
          begin: ELIXIR_IDENT_RE + ':(?!:)',
          relevance: 0
        },
        { // Usage of a module, struct, etc.
          className: 'title.class',
          begin: /(\b[A-Z][a-zA-Z0-9_]+)/,
          relevance: 0
        },
        NUMBER,
        {
          className: 'variable',
          begin: '(\\$\\W)|((\\$|@@?)(\\w+))'
        }
        // -> has been removed, capnproto always uses this grammar construct
      ];
      SUBST.contains = ELIXIR_DEFAULT_CONTAINS;

      return {
        name: 'Elixir',
        aliases: [
          'ex',
          'exs'
        ],
        keywords: KWS,
        contains: ELIXIR_DEFAULT_CONTAINS
      };
    }

    /*
    Language: Elm
    Author: Janis Voigtlaender <janis.voigtlaender@gmail.com>
    Website: https://elm-lang.org
    Category: functional
    */

    /** @type LanguageFn */
    function elm(hljs) {
      const COMMENT = { variants: [
        hljs.COMMENT('--', '$'),
        hljs.COMMENT(
          /\{-/,
          /-\}/,
          { contains: [ 'self' ] }
        )
      ] };

      const CONSTRUCTOR = {
        className: 'type',
        begin: '\\b[A-Z][\\w\']*', // TODO: other constructors (built-in, infix).
        relevance: 0
      };

      const LIST = {
        begin: '\\(',
        end: '\\)',
        illegal: '"',
        contains: [
          {
            className: 'type',
            begin: '\\b[A-Z][\\w]*(\\((\\.\\.|,|\\w+)\\))?'
          },
          COMMENT
        ]
      };

      const RECORD = {
        begin: /\{/,
        end: /\}/,
        contains: LIST.contains
      };

      const CHARACTER = {
        className: 'string',
        begin: '\'\\\\?.',
        end: '\'',
        illegal: '.'
      };

      const KEYWORDS = [
        "let",
        "in",
        "if",
        "then",
        "else",
        "case",
        "of",
        "where",
        "module",
        "import",
        "exposing",
        "type",
        "alias",
        "as",
        "infix",
        "infixl",
        "infixr",
        "port",
        "effect",
        "command",
        "subscription"
      ];

      return {
        name: 'Elm',
        keywords: KEYWORDS,
        contains: [

          // Top-level constructions.

          {
            beginKeywords: 'port effect module',
            end: 'exposing',
            keywords: 'port effect module where command subscription exposing',
            contains: [
              LIST,
              COMMENT
            ],
            illegal: '\\W\\.|;'
          },
          {
            begin: 'import',
            end: '$',
            keywords: 'import as exposing',
            contains: [
              LIST,
              COMMENT
            ],
            illegal: '\\W\\.|;'
          },
          {
            begin: 'type',
            end: '$',
            keywords: 'type alias',
            contains: [
              CONSTRUCTOR,
              LIST,
              RECORD,
              COMMENT
            ]
          },
          {
            beginKeywords: 'infix infixl infixr',
            end: '$',
            contains: [
              hljs.C_NUMBER_MODE,
              COMMENT
            ]
          },
          {
            begin: 'port',
            end: '$',
            keywords: 'port',
            contains: [ COMMENT ]
          },

          // Literals and names.
          CHARACTER,
          hljs.QUOTE_STRING_MODE,
          hljs.C_NUMBER_MODE,
          CONSTRUCTOR,
          hljs.inherit(hljs.TITLE_MODE, { begin: '^[_a-z][\\w\']*' }),
          COMMENT,

          { // No markup, relevance booster
            begin: '->|<-' }
        ],
        illegal: /;/
      };
    }

    /*
    Language: Erlang
    Description: Erlang is a general-purpose functional language, with strict evaluation, single assignment, and dynamic typing.
    Author: Nikolay Zakharov <nikolay.desh@gmail.com>, Dmitry Kovega <arhibot@gmail.com>
    Website: https://www.erlang.org
    Category: functional
    */

    /** @type LanguageFn */
    function erlang(hljs) {
      const BASIC_ATOM_RE = '[a-z\'][a-zA-Z0-9_\']*';
      const FUNCTION_NAME_RE = '(' + BASIC_ATOM_RE + ':' + BASIC_ATOM_RE + '|' + BASIC_ATOM_RE + ')';
      const ERLANG_RESERVED = {
        keyword:
          'after and andalso|10 band begin bnot bor bsl bzr bxor case catch cond div end fun if '
          + 'let not of orelse|10 query receive rem try when xor',
        literal:
          'false true'
      };

      const COMMENT = hljs.COMMENT('%', '$');
      const NUMBER = {
        className: 'number',
        begin: '\\b(\\d+(_\\d+)*#[a-fA-F0-9]+(_[a-fA-F0-9]+)*|\\d+(_\\d+)*(\\.\\d+(_\\d+)*)?([eE][-+]?\\d+)?)',
        relevance: 0
      };
      const NAMED_FUN = { begin: 'fun\\s+' + BASIC_ATOM_RE + '/\\d+' };
      const FUNCTION_CALL = {
        begin: FUNCTION_NAME_RE + '\\(',
        end: '\\)',
        returnBegin: true,
        relevance: 0,
        contains: [
          {
            begin: FUNCTION_NAME_RE,
            relevance: 0
          },
          {
            begin: '\\(',
            end: '\\)',
            endsWithParent: true,
            returnEnd: true,
            relevance: 0
            // "contains" defined later
          }
        ]
      };
      const TUPLE = {
        begin: /\{/,
        end: /\}/,
        relevance: 0
        // "contains" defined later
      };
      const VAR1 = {
        begin: '\\b_([A-Z][A-Za-z0-9_]*)?',
        relevance: 0
      };
      const VAR2 = {
        begin: '[A-Z][a-zA-Z0-9_]*',
        relevance: 0
      };
      const RECORD_ACCESS = {
        begin: '#' + hljs.UNDERSCORE_IDENT_RE,
        relevance: 0,
        returnBegin: true,
        contains: [
          {
            begin: '#' + hljs.UNDERSCORE_IDENT_RE,
            relevance: 0
          },
          {
            begin: /\{/,
            end: /\}/,
            relevance: 0
            // "contains" defined later
          }
        ]
      };

      const BLOCK_STATEMENTS = {
        beginKeywords: 'fun receive if try case',
        end: 'end',
        keywords: ERLANG_RESERVED
      };
      BLOCK_STATEMENTS.contains = [
        COMMENT,
        NAMED_FUN,
        hljs.inherit(hljs.APOS_STRING_MODE, { className: '' }),
        BLOCK_STATEMENTS,
        FUNCTION_CALL,
        hljs.QUOTE_STRING_MODE,
        NUMBER,
        TUPLE,
        VAR1,
        VAR2,
        RECORD_ACCESS
      ];

      const BASIC_MODES = [
        COMMENT,
        NAMED_FUN,
        BLOCK_STATEMENTS,
        FUNCTION_CALL,
        hljs.QUOTE_STRING_MODE,
        NUMBER,
        TUPLE,
        VAR1,
        VAR2,
        RECORD_ACCESS
      ];
      FUNCTION_CALL.contains[1].contains = BASIC_MODES;
      TUPLE.contains = BASIC_MODES;
      RECORD_ACCESS.contains[1].contains = BASIC_MODES;

      const DIRECTIVES = [
        "-module",
        "-record",
        "-undef",
        "-export",
        "-ifdef",
        "-ifndef",
        "-author",
        "-copyright",
        "-doc",
        "-vsn",
        "-import",
        "-include",
        "-include_lib",
        "-compile",
        "-define",
        "-else",
        "-endif",
        "-file",
        "-behaviour",
        "-behavior",
        "-spec"
      ];

      const PARAMS = {
        className: 'params',
        begin: '\\(',
        end: '\\)',
        contains: BASIC_MODES
      };
      return {
        name: 'Erlang',
        aliases: [ 'erl' ],
        keywords: ERLANG_RESERVED,
        illegal: '(</|\\*=|\\+=|-=|/\\*|\\*/|\\(\\*|\\*\\))',
        contains: [
          {
            className: 'function',
            begin: '^' + BASIC_ATOM_RE + '\\s*\\(',
            end: '->',
            returnBegin: true,
            illegal: '\\(|#|//|/\\*|\\\\|:|;',
            contains: [
              PARAMS,
              hljs.inherit(hljs.TITLE_MODE, { begin: BASIC_ATOM_RE })
            ],
            starts: {
              end: ';|\\.',
              keywords: ERLANG_RESERVED,
              contains: BASIC_MODES
            }
          },
          COMMENT,
          {
            begin: '^-',
            end: '\\.',
            relevance: 0,
            excludeEnd: true,
            returnBegin: true,
            keywords: {
              $pattern: '-' + hljs.IDENT_RE,
              keyword: DIRECTIVES.map(x => `${x}|1.5`).join(" ")
            },
            contains: [ PARAMS ]
          },
          NUMBER,
          hljs.QUOTE_STRING_MODE,
          RECORD_ACCESS,
          VAR1,
          VAR2,
          TUPLE,
          { begin: /\.$/ } // relevance booster
        ]
      };
    }

    /*
    Language: Fortran
    Author: Anthony Scemama <scemama@irsamc.ups-tlse.fr>
    Website: https://en.wikipedia.org/wiki/Fortran
    Category: scientific
    */

    /** @type LanguageFn */
    function fortran(hljs) {
      const regex = hljs.regex;
      const PARAMS = {
        className: 'params',
        begin: '\\(',
        end: '\\)'
      };

      const COMMENT = { variants: [
        hljs.COMMENT('!', '$', { relevance: 0 }),
        // allow FORTRAN 77 style comments
        hljs.COMMENT('^C[ ]', '$', { relevance: 0 }),
        hljs.COMMENT('^C$', '$', { relevance: 0 })
      ] };

      // regex in both fortran and irpf90 should match
      const OPTIONAL_NUMBER_SUFFIX = /(_[a-z_\d]+)?/;
      const OPTIONAL_NUMBER_EXP = /([de][+-]?\d+)?/;
      const NUMBER = {
        className: 'number',
        variants: [
          { begin: regex.concat(/\b\d+/, /\.(\d*)/, OPTIONAL_NUMBER_EXP, OPTIONAL_NUMBER_SUFFIX) },
          { begin: regex.concat(/\b\d+/, OPTIONAL_NUMBER_EXP, OPTIONAL_NUMBER_SUFFIX) },
          { begin: regex.concat(/\.\d+/, OPTIONAL_NUMBER_EXP, OPTIONAL_NUMBER_SUFFIX) }
        ],
        relevance: 0
      };

      const FUNCTION_DEF = {
        className: 'function',
        beginKeywords: 'subroutine function program',
        illegal: '[${=\\n]',
        contains: [
          hljs.UNDERSCORE_TITLE_MODE,
          PARAMS
        ]
      };

      const STRING = {
        className: 'string',
        relevance: 0,
        variants: [
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE
        ]
      };

      const KEYWORDS = [
        "kind",
        "do",
        "concurrent",
        "local",
        "shared",
        "while",
        "private",
        "call",
        "intrinsic",
        "where",
        "elsewhere",
        "type",
        "endtype",
        "endmodule",
        "endselect",
        "endinterface",
        "end",
        "enddo",
        "endif",
        "if",
        "forall",
        "endforall",
        "only",
        "contains",
        "default",
        "return",
        "stop",
        "then",
        "block",
        "endblock",
        "endassociate",
        "public",
        "subroutine|10",
        "function",
        "program",
        ".and.",
        ".or.",
        ".not.",
        ".le.",
        ".eq.",
        ".ge.",
        ".gt.",
        ".lt.",
        "goto",
        "save",
        "else",
        "use",
        "module",
        "select",
        "case",
        "access",
        "blank",
        "direct",
        "exist",
        "file",
        "fmt",
        "form",
        "formatted",
        "iostat",
        "name",
        "named",
        "nextrec",
        "number",
        "opened",
        "rec",
        "recl",
        "sequential",
        "status",
        "unformatted",
        "unit",
        "continue",
        "format",
        "pause",
        "cycle",
        "exit",
        "c_null_char",
        "c_alert",
        "c_backspace",
        "c_form_feed",
        "flush",
        "wait",
        "decimal",
        "round",
        "iomsg",
        "synchronous",
        "nopass",
        "non_overridable",
        "pass",
        "protected",
        "volatile",
        "abstract",
        "extends",
        "import",
        "non_intrinsic",
        "value",
        "deferred",
        "generic",
        "final",
        "enumerator",
        "class",
        "associate",
        "bind",
        "enum",
        "c_int",
        "c_short",
        "c_long",
        "c_long_long",
        "c_signed_char",
        "c_size_t",
        "c_int8_t",
        "c_int16_t",
        "c_int32_t",
        "c_int64_t",
        "c_int_least8_t",
        "c_int_least16_t",
        "c_int_least32_t",
        "c_int_least64_t",
        "c_int_fast8_t",
        "c_int_fast16_t",
        "c_int_fast32_t",
        "c_int_fast64_t",
        "c_intmax_t",
        "C_intptr_t",
        "c_float",
        "c_double",
        "c_long_double",
        "c_float_complex",
        "c_double_complex",
        "c_long_double_complex",
        "c_bool",
        "c_char",
        "c_null_ptr",
        "c_null_funptr",
        "c_new_line",
        "c_carriage_return",
        "c_horizontal_tab",
        "c_vertical_tab",
        "iso_c_binding",
        "c_loc",
        "c_funloc",
        "c_associated",
        "c_f_pointer",
        "c_ptr",
        "c_funptr",
        "iso_fortran_env",
        "character_storage_size",
        "error_unit",
        "file_storage_size",
        "input_unit",
        "iostat_end",
        "iostat_eor",
        "numeric_storage_size",
        "output_unit",
        "c_f_procpointer",
        "ieee_arithmetic",
        "ieee_support_underflow_control",
        "ieee_get_underflow_mode",
        "ieee_set_underflow_mode",
        "newunit",
        "contiguous",
        "recursive",
        "pad",
        "position",
        "action",
        "delim",
        "readwrite",
        "eor",
        "advance",
        "nml",
        "interface",
        "procedure",
        "namelist",
        "include",
        "sequence",
        "elemental",
        "pure",
        "impure",
        "integer",
        "real",
        "character",
        "complex",
        "logical",
        "codimension",
        "dimension",
        "allocatable|10",
        "parameter",
        "external",
        "implicit|10",
        "none",
        "double",
        "precision",
        "assign",
        "intent",
        "optional",
        "pointer",
        "target",
        "in",
        "out",
        "common",
        "equivalence",
        "data"
      ];
      const LITERALS = [
        ".False.",
        ".True."
      ];
      const BUILT_INS = [
        "alog",
        "alog10",
        "amax0",
        "amax1",
        "amin0",
        "amin1",
        "amod",
        "cabs",
        "ccos",
        "cexp",
        "clog",
        "csin",
        "csqrt",
        "dabs",
        "dacos",
        "dasin",
        "datan",
        "datan2",
        "dcos",
        "dcosh",
        "ddim",
        "dexp",
        "dint",
        "dlog",
        "dlog10",
        "dmax1",
        "dmin1",
        "dmod",
        "dnint",
        "dsign",
        "dsin",
        "dsinh",
        "dsqrt",
        "dtan",
        "dtanh",
        "float",
        "iabs",
        "idim",
        "idint",
        "idnint",
        "ifix",
        "isign",
        "max0",
        "max1",
        "min0",
        "min1",
        "sngl",
        "algama",
        "cdabs",
        "cdcos",
        "cdexp",
        "cdlog",
        "cdsin",
        "cdsqrt",
        "cqabs",
        "cqcos",
        "cqexp",
        "cqlog",
        "cqsin",
        "cqsqrt",
        "dcmplx",
        "dconjg",
        "derf",
        "derfc",
        "dfloat",
        "dgamma",
        "dimag",
        "dlgama",
        "iqint",
        "qabs",
        "qacos",
        "qasin",
        "qatan",
        "qatan2",
        "qcmplx",
        "qconjg",
        "qcos",
        "qcosh",
        "qdim",
        "qerf",
        "qerfc",
        "qexp",
        "qgamma",
        "qimag",
        "qlgama",
        "qlog",
        "qlog10",
        "qmax1",
        "qmin1",
        "qmod",
        "qnint",
        "qsign",
        "qsin",
        "qsinh",
        "qsqrt",
        "qtan",
        "qtanh",
        "abs",
        "acos",
        "aimag",
        "aint",
        "anint",
        "asin",
        "atan",
        "atan2",
        "char",
        "cmplx",
        "conjg",
        "cos",
        "cosh",
        "exp",
        "ichar",
        "index",
        "int",
        "log",
        "log10",
        "max",
        "min",
        "nint",
        "sign",
        "sin",
        "sinh",
        "sqrt",
        "tan",
        "tanh",
        "print",
        "write",
        "dim",
        "lge",
        "lgt",
        "lle",
        "llt",
        "mod",
        "nullify",
        "allocate",
        "deallocate",
        "adjustl",
        "adjustr",
        "all",
        "allocated",
        "any",
        "associated",
        "bit_size",
        "btest",
        "ceiling",
        "count",
        "cshift",
        "date_and_time",
        "digits",
        "dot_product",
        "eoshift",
        "epsilon",
        "exponent",
        "floor",
        "fraction",
        "huge",
        "iand",
        "ibclr",
        "ibits",
        "ibset",
        "ieor",
        "ior",
        "ishft",
        "ishftc",
        "lbound",
        "len_trim",
        "matmul",
        "maxexponent",
        "maxloc",
        "maxval",
        "merge",
        "minexponent",
        "minloc",
        "minval",
        "modulo",
        "mvbits",
        "nearest",
        "pack",
        "present",
        "product",
        "radix",
        "random_number",
        "random_seed",
        "range",
        "repeat",
        "reshape",
        "rrspacing",
        "scale",
        "scan",
        "selected_int_kind",
        "selected_real_kind",
        "set_exponent",
        "shape",
        "size",
        "spacing",
        "spread",
        "sum",
        "system_clock",
        "tiny",
        "transpose",
        "trim",
        "ubound",
        "unpack",
        "verify",
        "achar",
        "iachar",
        "transfer",
        "dble",
        "entry",
        "dprod",
        "cpu_time",
        "command_argument_count",
        "get_command",
        "get_command_argument",
        "get_environment_variable",
        "is_iostat_end",
        "ieee_arithmetic",
        "ieee_support_underflow_control",
        "ieee_get_underflow_mode",
        "ieee_set_underflow_mode",
        "is_iostat_eor",
        "move_alloc",
        "new_line",
        "selected_char_kind",
        "same_type_as",
        "extends_type_of",
        "acosh",
        "asinh",
        "atanh",
        "bessel_j0",
        "bessel_j1",
        "bessel_jn",
        "bessel_y0",
        "bessel_y1",
        "bessel_yn",
        "erf",
        "erfc",
        "erfc_scaled",
        "gamma",
        "log_gamma",
        "hypot",
        "norm2",
        "atomic_define",
        "atomic_ref",
        "execute_command_line",
        "leadz",
        "trailz",
        "storage_size",
        "merge_bits",
        "bge",
        "bgt",
        "ble",
        "blt",
        "dshiftl",
        "dshiftr",
        "findloc",
        "iall",
        "iany",
        "iparity",
        "image_index",
        "lcobound",
        "ucobound",
        "maskl",
        "maskr",
        "num_images",
        "parity",
        "popcnt",
        "poppar",
        "shifta",
        "shiftl",
        "shiftr",
        "this_image",
        "sync",
        "change",
        "team",
        "co_broadcast",
        "co_max",
        "co_min",
        "co_sum",
        "co_reduce"
      ];
      return {
        name: 'Fortran',
        case_insensitive: true,
        aliases: [
          'f90',
          'f95'
        ],
        keywords: {
          keyword: KEYWORDS,
          literal: LITERALS,
          built_in: BUILT_INS
        },
        illegal: /\/\*/,
        contains: [
          STRING,
          FUNCTION_DEF,
          // allow `C = value` for assignments so they aren't misdetected
          // as Fortran 77 style comments
          {
            begin: /^C\s*=(?!=)/,
            relevance: 0
          },
          COMMENT,
          NUMBER
        ]
      };
    }

    /*
    Language: F#
    Author: Jonas Follesø <jonas@follesoe.no>
    Contributors: Troy Kershaw <hello@troykershaw.com>, Henrik Feldt <henrik@haf.se>, Melvyn Laïly <melvyn.laily@gmail.com>
    Website: https://docs.microsoft.com/en-us/dotnet/fsharp/
    Category: functional
    */

    /** @type LanguageFn */
    function fsharp(hljs) {
      const KEYWORDS = [
        "abstract",
        "and",
        "as",
        "assert",
        "base",
        "begin",
        "class",
        "default",
        "delegate",
        "do",
        "done",
        "downcast",
        "downto",
        "elif",
        "else",
        "end",
        "exception",
        "extern",
        // "false", // literal
        "finally",
        "fixed",
        "for",
        "fun",
        "function",
        "global",
        "if",
        "in",
        "inherit",
        "inline",
        "interface",
        "internal",
        "lazy",
        "let",
        "match",
        "member",
        "module",
        "mutable",
        "namespace",
        "new",
        // "not", // built_in
        // "null", // literal
        "of",
        "open",
        "or",
        "override",
        "private",
        "public",
        "rec",
        "return",
        "static",
        "struct",
        "then",
        "to",
        // "true", // literal
        "try",
        "type",
        "upcast",
        "use",
        "val",
        "void",
        "when",
        "while",
        "with",
        "yield"
      ];

      const BANG_KEYWORD_MODE = {
        // monad builder keywords (matches before non-bang keywords)
        scope: 'keyword',
        match: /\b(yield|return|let|do|match|use)!/
      };

      const PREPROCESSOR_KEYWORDS = [
        "if",
        "else",
        "endif",
        "line",
        "nowarn",
        "light",
        "r",
        "i",
        "I",
        "load",
        "time",
        "help",
        "quit"
      ];

      const LITERALS = [
        "true",
        "false",
        "null",
        "Some",
        "None",
        "Ok",
        "Error",
        "infinity",
        "infinityf",
        "nan",
        "nanf"
      ];

      const SPECIAL_IDENTIFIERS = [
        "__LINE__",
        "__SOURCE_DIRECTORY__",
        "__SOURCE_FILE__"
      ];

      // Since it's possible to re-bind/shadow names (e.g. let char = 'c'),
      // these builtin types should only be matched when a type name is expected.
      const KNOWN_TYPES = [
        // basic types
        "bool",
        "byte",
        "sbyte",
        "int8",
        "int16",
        "int32",
        "uint8",
        "uint16",
        "uint32",
        "int",
        "uint",
        "int64",
        "uint64",
        "nativeint",
        "unativeint",
        "decimal",
        "float",
        "double",
        "float32",
        "single",
        "char",
        "string",
        "unit",
        "bigint",
        // other native types or lowercase aliases
        "option",
        "voption",
        "list",
        "array",
        "seq",
        "byref",
        "exn",
        "inref",
        "nativeptr",
        "obj",
        "outref",
        "voidptr",
        // other important FSharp types
        "Result"
      ];

      const BUILTINS = [
        // Somewhat arbitrary list of builtin functions and values.
        // Most of them are declared in Microsoft.FSharp.Core
        // I tried to stay relevant by adding only the most idiomatic
        // and most used symbols that are not already declared as types.
        "not",
        "ref",
        "raise",
        "reraise",
        "dict",
        "readOnlyDict",
        "set",
        "get",
        "enum",
        "sizeof",
        "typeof",
        "typedefof",
        "nameof",
        "nullArg",
        "invalidArg",
        "invalidOp",
        "id",
        "fst",
        "snd",
        "ignore",
        "lock",
        "using",
        "box",
        "unbox",
        "tryUnbox",
        "printf",
        "printfn",
        "sprintf",
        "eprintf",
        "eprintfn",
        "fprintf",
        "fprintfn",
        "failwith",
        "failwithf"
      ];

      const ALL_KEYWORDS = {
        keyword: KEYWORDS,
        literal: LITERALS,
        built_in: BUILTINS,
        'variable.constant': SPECIAL_IDENTIFIERS
      };

      // (* potentially multi-line Meta Language style comment *)
      const ML_COMMENT =
        hljs.COMMENT(/\(\*(?!\))/, /\*\)/, {
          contains: ["self"]
        });
      // Either a multi-line (* Meta Language style comment *) or a single line // C style comment.
      const COMMENT = {
        variants: [
          ML_COMMENT,
          hljs.C_LINE_COMMENT_MODE,
        ]
      };

      // Most identifiers can contain apostrophes
      const IDENTIFIER_RE = /[a-zA-Z_](\w|')*/;

      const QUOTED_IDENTIFIER = {
        scope: 'variable',
        begin: /``/,
        end: /``/
      };

      // 'a or ^a where a can be a ``quoted identifier``
      const BEGIN_GENERIC_TYPE_SYMBOL_RE = /\B('|\^)/;
      const GENERIC_TYPE_SYMBOL = {
        scope: 'symbol',
        variants: [
          // the type name is a quoted identifier:
          { match: concat(BEGIN_GENERIC_TYPE_SYMBOL_RE, /``.*?``/) },
          // the type name is a normal identifier (we don't use IDENTIFIER_RE because there cannot be another apostrophe here):
          { match: concat(BEGIN_GENERIC_TYPE_SYMBOL_RE, hljs.UNDERSCORE_IDENT_RE) }
        ],
        relevance: 0
      };

      const makeOperatorMode = function({ includeEqual }) {
        // List or symbolic operator characters from the FSharp Spec 4.1, minus the dot, and with `?` added, used for nullable operators.
        let allOperatorChars;
        if (includeEqual)
          allOperatorChars = "!%&*+-/<=>@^|~?";
        else
          allOperatorChars = "!%&*+-/<>@^|~?";
        const OPERATOR_CHARS = Array.from(allOperatorChars);
        const OPERATOR_CHAR_RE = concat('[', ...OPERATOR_CHARS.map(escape$1), ']');
        // The lone dot operator is special. It cannot be redefined, and we don't want to highlight it. It can be used as part of a multi-chars operator though.
        const OPERATOR_CHAR_OR_DOT_RE = either(OPERATOR_CHAR_RE, /\./);
        // When a dot is present, it must be followed by another operator char:
        const OPERATOR_FIRST_CHAR_OF_MULTIPLE_RE = concat(OPERATOR_CHAR_OR_DOT_RE, lookahead(OPERATOR_CHAR_OR_DOT_RE));
        const SYMBOLIC_OPERATOR_RE = either(
          concat(OPERATOR_FIRST_CHAR_OF_MULTIPLE_RE, OPERATOR_CHAR_OR_DOT_RE, '*'), // Matches at least 2 chars operators
          concat(OPERATOR_CHAR_RE, '+'), // Matches at least one char operators
        );
        return {
          scope: 'operator',
          match: either(
            // symbolic operators:
            SYMBOLIC_OPERATOR_RE,
            // other symbolic keywords:
            // Type casting and conversion operators:
            /:\?>/,
            /:\?/,
            /:>/,
            /:=/, // Reference cell assignment
            /::?/, // : or ::
            /\$/), // A single $ can be used as an operator
          relevance: 0
        };
      };

      const OPERATOR = makeOperatorMode({ includeEqual: true });
      // This variant is used when matching '=' should end a parent mode:
      const OPERATOR_WITHOUT_EQUAL = makeOperatorMode({ includeEqual: false });

      const makeTypeAnnotationMode = function(prefix, prefixScope) {
        return {
          begin: concat( // a type annotation is a
            prefix,            // should be a colon or the 'of' keyword
            lookahead(   // that has to be followed by
              concat(
                /\s*/,         // optional space
                either(  // then either of:
                  /\w/,        // word
                  /'/,         // generic type name
                  /\^/,        // generic type name
                  /#/,         // flexible type name
                  /``/,        // quoted type name
                  /\(/,        // parens type expression
                  /{\|/,       // anonymous type annotation
          )))),
          beginScope: prefixScope,
          // BUG: because ending with \n is necessary for some cases, multi-line type annotations are not properly supported.
          // Examples where \n is required at the end:
          // - abstract member definitions in classes: abstract Property : int * string
          // - return type annotations: let f f' = f' () : returnTypeAnnotation
          // - record fields definitions: { A : int \n B : string }
          end: lookahead(
            either(
              /\n/,
              /=/)),
          relevance: 0,
          // we need the known types, and we need the type constraint keywords and literals. e.g.: when 'a : null
          keywords: hljs.inherit(ALL_KEYWORDS, { type: KNOWN_TYPES }),
          contains: [
            COMMENT,
            GENERIC_TYPE_SYMBOL,
            hljs.inherit(QUOTED_IDENTIFIER, { scope: null }), // match to avoid strange patterns inside that may break the parsing
            OPERATOR_WITHOUT_EQUAL
          ]
        };
      };

      const TYPE_ANNOTATION = makeTypeAnnotationMode(/:/, 'operator');
      const DISCRIMINATED_UNION_TYPE_ANNOTATION = makeTypeAnnotationMode(/\bof\b/, 'keyword');

      // type MyType<'a> = ...
      const TYPE_DECLARATION = {
        begin: [
          /(^|\s+)/, // prevents matching the following: `match s.stype with`
          /type/,
          /\s+/,
          IDENTIFIER_RE
        ],
        beginScope: {
          2: 'keyword',
          4: 'title.class'
        },
        end: lookahead(/\(|=|$/),
        keywords: ALL_KEYWORDS, // match keywords in type constraints. e.g.: when 'a : null
        contains: [
          COMMENT,
          hljs.inherit(QUOTED_IDENTIFIER, { scope: null }), // match to avoid strange patterns inside that may break the parsing
          GENERIC_TYPE_SYMBOL,
          {
            // For visual consistency, highlight type brackets as operators.
            scope: 'operator',
            match: /<|>/
          },
          TYPE_ANNOTATION // generic types can have constraints, which are type annotations. e.g. type MyType<'T when 'T : delegate<obj * string>> =
        ]
      };

      const COMPUTATION_EXPRESSION = {
        // computation expressions:
        scope: 'computation-expression',
        // BUG: might conflict with record deconstruction. e.g. let f { Name = name } = name // will highlight f
        match: /\b[_a-z]\w*(?=\s*\{)/
      };

      const PREPROCESSOR = {
        // preprocessor directives and fsi commands:
        begin: [
          /^\s*/,
          concat(/#/, either(...PREPROCESSOR_KEYWORDS)),
          /\b/
        ],
        beginScope: { 2: 'meta' },
        end: lookahead(/\s|$/)
      };

      // TODO: this definition is missing support for type suffixes and octal notation.
      // BUG: range operator without any space is wrongly interpreted as a single number (e.g. 1..10 )
      const NUMBER = {
        variants: [
          hljs.BINARY_NUMBER_MODE,
          hljs.C_NUMBER_MODE
        ]
      };

      // All the following string definitions are potentially multi-line.
      // BUG: these definitions are missing support for byte strings (suffixed with B)

      // "..."
      const QUOTED_STRING = {
        scope: 'string',
        begin: /"/,
        end: /"/,
        contains: [
          hljs.BACKSLASH_ESCAPE
        ]
      };
      // @"..."
      const VERBATIM_STRING = {
        scope: 'string',
        begin: /@"/,
        end: /"/,
        contains: [
          {
            match: /""/ // escaped "
          },
          hljs.BACKSLASH_ESCAPE
        ]
      };
      // """..."""
      const TRIPLE_QUOTED_STRING = {
        scope: 'string',
        begin: /"""/,
        end: /"""/,
        relevance: 2
      };
      const SUBST = {
        scope: 'subst',
        begin: /\{/,
        end: /\}/,
        keywords: ALL_KEYWORDS
      };
      // $"...{1+1}..."
      const INTERPOLATED_STRING = {
        scope: 'string',
        begin: /\$"/,
        end: /"/,
        contains: [
          {
            match: /\{\{/ // escaped {
          },
          {
            match: /\}\}/ // escaped }
          },
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ]
      };
      // $@"...{1+1}..."
      const INTERPOLATED_VERBATIM_STRING = {
        scope: 'string',
        begin: /(\$@|@\$)"/,
        end: /"/,
        contains: [
          {
            match: /\{\{/ // escaped {
          },
          {
            match: /\}\}/ // escaped }
          },
          {
            match: /""/
          },
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ]
      };
      // $"""...{1+1}..."""
      const INTERPOLATED_TRIPLE_QUOTED_STRING = {
        scope: 'string',
        begin: /\$"""/,
        end: /"""/,
        contains: [
          {
            match: /\{\{/ // escaped {
          },
          {
            match: /\}\}/ // escaped }
          },
          SUBST
        ],
        relevance: 2
      };
      // '.'
      const CHAR_LITERAL = {
        scope: 'string',
        match: concat(
          /'/,
          either(
            /[^\\']/, // either a single non escaped char...
            /\\(?:.|\d{3}|x[a-fA-F\d]{2}|u[a-fA-F\d]{4}|U[a-fA-F\d]{8})/ // ...or an escape sequence
          ),
          /'/
        )
      };
      // F# allows a lot of things inside string placeholders.
      // Things that don't currently seem allowed by the compiler: types definition, attributes usage.
      // (Strictly speaking, some of the followings are only allowed inside triple quoted interpolated strings...)
      SUBST.contains = [
        INTERPOLATED_VERBATIM_STRING,
        INTERPOLATED_STRING,
        VERBATIM_STRING,
        QUOTED_STRING,
        CHAR_LITERAL,
        BANG_KEYWORD_MODE,
        COMMENT,
        QUOTED_IDENTIFIER,
        TYPE_ANNOTATION,
        COMPUTATION_EXPRESSION,
        PREPROCESSOR,
        NUMBER,
        GENERIC_TYPE_SYMBOL,
        OPERATOR
      ];
      const STRING = {
        variants: [
          INTERPOLATED_TRIPLE_QUOTED_STRING,
          INTERPOLATED_VERBATIM_STRING,
          INTERPOLATED_STRING,
          TRIPLE_QUOTED_STRING,
          VERBATIM_STRING,
          QUOTED_STRING,
          CHAR_LITERAL
        ]
      };

      return {
        name: 'F#',
        aliases: [
          'fs',
          'f#'
        ],
        keywords: ALL_KEYWORDS,
        illegal: /\/\*/,
        classNameAliases: {
          'computation-expression': 'keyword'
        },
        contains: [
          BANG_KEYWORD_MODE,
          STRING,
          COMMENT,
          QUOTED_IDENTIFIER,
          TYPE_DECLARATION,
          {
            // e.g. [<Attributes("")>] or [<``module``: MyCustomAttributeThatWorksOnModules>]
            // or [<Sealed; NoEquality; NoComparison; CompiledName("FSharpAsync`1")>]
            scope: 'meta',
            begin: /\[</,
            end: />\]/,
            relevance: 2,
            contains: [
              QUOTED_IDENTIFIER,
              // can contain any constant value
              TRIPLE_QUOTED_STRING,
              VERBATIM_STRING,
              QUOTED_STRING,
              CHAR_LITERAL,
              NUMBER
            ]
          },
          DISCRIMINATED_UNION_TYPE_ANNOTATION,
          TYPE_ANNOTATION,
          COMPUTATION_EXPRESSION,
          PREPROCESSOR,
          NUMBER,
          GENERIC_TYPE_SYMBOL,
          OPERATOR
        ]
      };
    }

    /*
    Language: GLSL
    Description: OpenGL Shading Language
    Author: Sergey Tikhomirov <sergey@tikhomirov.io>
    Website: https://en.wikipedia.org/wiki/OpenGL_Shading_Language
    Category: graphics
    */

    function glsl(hljs) {
      return {
        name: 'GLSL',
        keywords: {
          keyword:
            // Statements
            'break continue discard do else for if return while switch case default '
            // Qualifiers
            + 'attribute binding buffer ccw centroid centroid varying coherent column_major const cw '
            + 'depth_any depth_greater depth_less depth_unchanged early_fragment_tests equal_spacing '
            + 'flat fractional_even_spacing fractional_odd_spacing highp in index inout invariant '
            + 'invocations isolines layout line_strip lines lines_adjacency local_size_x local_size_y '
            + 'local_size_z location lowp max_vertices mediump noperspective offset origin_upper_left '
            + 'out packed patch pixel_center_integer point_mode points precise precision quads r11f_g11f_b10f '
            + 'r16 r16_snorm r16f r16i r16ui r32f r32i r32ui r8 r8_snorm r8i r8ui readonly restrict '
            + 'rg16 rg16_snorm rg16f rg16i rg16ui rg32f rg32i rg32ui rg8 rg8_snorm rg8i rg8ui rgb10_a2 '
            + 'rgb10_a2ui rgba16 rgba16_snorm rgba16f rgba16i rgba16ui rgba32f rgba32i rgba32ui rgba8 '
            + 'rgba8_snorm rgba8i rgba8ui row_major sample shared smooth std140 std430 stream triangle_strip '
            + 'triangles triangles_adjacency uniform varying vertices volatile writeonly',
          type:
            'atomic_uint bool bvec2 bvec3 bvec4 dmat2 dmat2x2 dmat2x3 dmat2x4 dmat3 dmat3x2 dmat3x3 '
            + 'dmat3x4 dmat4 dmat4x2 dmat4x3 dmat4x4 double dvec2 dvec3 dvec4 float iimage1D iimage1DArray '
            + 'iimage2D iimage2DArray iimage2DMS iimage2DMSArray iimage2DRect iimage3D iimageBuffer '
            + 'iimageCube iimageCubeArray image1D image1DArray image2D image2DArray image2DMS image2DMSArray '
            + 'image2DRect image3D imageBuffer imageCube imageCubeArray int isampler1D isampler1DArray '
            + 'isampler2D isampler2DArray isampler2DMS isampler2DMSArray isampler2DRect isampler3D '
            + 'isamplerBuffer isamplerCube isamplerCubeArray ivec2 ivec3 ivec4 mat2 mat2x2 mat2x3 '
            + 'mat2x4 mat3 mat3x2 mat3x3 mat3x4 mat4 mat4x2 mat4x3 mat4x4 sampler1D sampler1DArray '
            + 'sampler1DArrayShadow sampler1DShadow sampler2D sampler2DArray sampler2DArrayShadow '
            + 'sampler2DMS sampler2DMSArray sampler2DRect sampler2DRectShadow sampler2DShadow sampler3D '
            + 'samplerBuffer samplerCube samplerCubeArray samplerCubeArrayShadow samplerCubeShadow '
            + 'image1D uimage1DArray uimage2D uimage2DArray uimage2DMS uimage2DMSArray uimage2DRect '
            + 'uimage3D uimageBuffer uimageCube uimageCubeArray uint usampler1D usampler1DArray '
            + 'usampler2D usampler2DArray usampler2DMS usampler2DMSArray usampler2DRect usampler3D '
            + 'samplerBuffer usamplerCube usamplerCubeArray uvec2 uvec3 uvec4 vec2 vec3 vec4 void',
          built_in:
            // Constants
            'gl_MaxAtomicCounterBindings gl_MaxAtomicCounterBufferSize gl_MaxClipDistances gl_MaxClipPlanes '
            + 'gl_MaxCombinedAtomicCounterBuffers gl_MaxCombinedAtomicCounters gl_MaxCombinedImageUniforms '
            + 'gl_MaxCombinedImageUnitsAndFragmentOutputs gl_MaxCombinedTextureImageUnits gl_MaxComputeAtomicCounterBuffers '
            + 'gl_MaxComputeAtomicCounters gl_MaxComputeImageUniforms gl_MaxComputeTextureImageUnits '
            + 'gl_MaxComputeUniformComponents gl_MaxComputeWorkGroupCount gl_MaxComputeWorkGroupSize '
            + 'gl_MaxDrawBuffers gl_MaxFragmentAtomicCounterBuffers gl_MaxFragmentAtomicCounters '
            + 'gl_MaxFragmentImageUniforms gl_MaxFragmentInputComponents gl_MaxFragmentInputVectors '
            + 'gl_MaxFragmentUniformComponents gl_MaxFragmentUniformVectors gl_MaxGeometryAtomicCounterBuffers '
            + 'gl_MaxGeometryAtomicCounters gl_MaxGeometryImageUniforms gl_MaxGeometryInputComponents '
            + 'gl_MaxGeometryOutputComponents gl_MaxGeometryOutputVertices gl_MaxGeometryTextureImageUnits '
            + 'gl_MaxGeometryTotalOutputComponents gl_MaxGeometryUniformComponents gl_MaxGeometryVaryingComponents '
            + 'gl_MaxImageSamples gl_MaxImageUnits gl_MaxLights gl_MaxPatchVertices gl_MaxProgramTexelOffset '
            + 'gl_MaxTessControlAtomicCounterBuffers gl_MaxTessControlAtomicCounters gl_MaxTessControlImageUniforms '
            + 'gl_MaxTessControlInputComponents gl_MaxTessControlOutputComponents gl_MaxTessControlTextureImageUnits '
            + 'gl_MaxTessControlTotalOutputComponents gl_MaxTessControlUniformComponents '
            + 'gl_MaxTessEvaluationAtomicCounterBuffers gl_MaxTessEvaluationAtomicCounters '
            + 'gl_MaxTessEvaluationImageUniforms gl_MaxTessEvaluationInputComponents gl_MaxTessEvaluationOutputComponents '
            + 'gl_MaxTessEvaluationTextureImageUnits gl_MaxTessEvaluationUniformComponents '
            + 'gl_MaxTessGenLevel gl_MaxTessPatchComponents gl_MaxTextureCoords gl_MaxTextureImageUnits '
            + 'gl_MaxTextureUnits gl_MaxVaryingComponents gl_MaxVaryingFloats gl_MaxVaryingVectors '
            + 'gl_MaxVertexAtomicCounterBuffers gl_MaxVertexAtomicCounters gl_MaxVertexAttribs gl_MaxVertexImageUniforms '
            + 'gl_MaxVertexOutputComponents gl_MaxVertexOutputVectors gl_MaxVertexTextureImageUnits '
            + 'gl_MaxVertexUniformComponents gl_MaxVertexUniformVectors gl_MaxViewports gl_MinProgramTexelOffset '
            // Variables
            + 'gl_BackColor gl_BackLightModelProduct gl_BackLightProduct gl_BackMaterial '
            + 'gl_BackSecondaryColor gl_ClipDistance gl_ClipPlane gl_ClipVertex gl_Color '
            + 'gl_DepthRange gl_EyePlaneQ gl_EyePlaneR gl_EyePlaneS gl_EyePlaneT gl_Fog gl_FogCoord '
            + 'gl_FogFragCoord gl_FragColor gl_FragCoord gl_FragData gl_FragDepth gl_FrontColor '
            + 'gl_FrontFacing gl_FrontLightModelProduct gl_FrontLightProduct gl_FrontMaterial '
            + 'gl_FrontSecondaryColor gl_GlobalInvocationID gl_InstanceID gl_InvocationID gl_Layer gl_LightModel '
            + 'gl_LightSource gl_LocalInvocationID gl_LocalInvocationIndex gl_ModelViewMatrix '
            + 'gl_ModelViewMatrixInverse gl_ModelViewMatrixInverseTranspose gl_ModelViewMatrixTranspose '
            + 'gl_ModelViewProjectionMatrix gl_ModelViewProjectionMatrixInverse gl_ModelViewProjectionMatrixInverseTranspose '
            + 'gl_ModelViewProjectionMatrixTranspose gl_MultiTexCoord0 gl_MultiTexCoord1 gl_MultiTexCoord2 '
            + 'gl_MultiTexCoord3 gl_MultiTexCoord4 gl_MultiTexCoord5 gl_MultiTexCoord6 gl_MultiTexCoord7 '
            + 'gl_Normal gl_NormalMatrix gl_NormalScale gl_NumSamples gl_NumWorkGroups gl_ObjectPlaneQ '
            + 'gl_ObjectPlaneR gl_ObjectPlaneS gl_ObjectPlaneT gl_PatchVerticesIn gl_Point gl_PointCoord '
            + 'gl_PointSize gl_Position gl_PrimitiveID gl_PrimitiveIDIn gl_ProjectionMatrix gl_ProjectionMatrixInverse '
            + 'gl_ProjectionMatrixInverseTranspose gl_ProjectionMatrixTranspose gl_SampleID gl_SampleMask '
            + 'gl_SampleMaskIn gl_SamplePosition gl_SecondaryColor gl_TessCoord gl_TessLevelInner gl_TessLevelOuter '
            + 'gl_TexCoord gl_TextureEnvColor gl_TextureMatrix gl_TextureMatrixInverse gl_TextureMatrixInverseTranspose '
            + 'gl_TextureMatrixTranspose gl_Vertex gl_VertexID gl_ViewportIndex gl_WorkGroupID gl_WorkGroupSize gl_in gl_out '
            // Functions
            + 'EmitStreamVertex EmitVertex EndPrimitive EndStreamPrimitive abs acos acosh all any asin '
            + 'asinh atan atanh atomicAdd atomicAnd atomicCompSwap atomicCounter atomicCounterDecrement '
            + 'atomicCounterIncrement atomicExchange atomicMax atomicMin atomicOr atomicXor barrier '
            + 'bitCount bitfieldExtract bitfieldInsert bitfieldReverse ceil clamp cos cosh cross '
            + 'dFdx dFdy degrees determinant distance dot equal exp exp2 faceforward findLSB findMSB '
            + 'floatBitsToInt floatBitsToUint floor fma fract frexp ftransform fwidth greaterThan '
            + 'greaterThanEqual groupMemoryBarrier imageAtomicAdd imageAtomicAnd imageAtomicCompSwap '
            + 'imageAtomicExchange imageAtomicMax imageAtomicMin imageAtomicOr imageAtomicXor imageLoad '
            + 'imageSize imageStore imulExtended intBitsToFloat interpolateAtCentroid interpolateAtOffset '
            + 'interpolateAtSample inverse inversesqrt isinf isnan ldexp length lessThan lessThanEqual log '
            + 'log2 matrixCompMult max memoryBarrier memoryBarrierAtomicCounter memoryBarrierBuffer '
            + 'memoryBarrierImage memoryBarrierShared min mix mod modf noise1 noise2 noise3 noise4 '
            + 'normalize not notEqual outerProduct packDouble2x32 packHalf2x16 packSnorm2x16 packSnorm4x8 '
            + 'packUnorm2x16 packUnorm4x8 pow radians reflect refract round roundEven shadow1D shadow1DLod '
            + 'shadow1DProj shadow1DProjLod shadow2D shadow2DLod shadow2DProj shadow2DProjLod sign sin sinh '
            + 'smoothstep sqrt step tan tanh texelFetch texelFetchOffset texture texture1D texture1DLod '
            + 'texture1DProj texture1DProjLod texture2D texture2DLod texture2DProj texture2DProjLod '
            + 'texture3D texture3DLod texture3DProj texture3DProjLod textureCube textureCubeLod '
            + 'textureGather textureGatherOffset textureGatherOffsets textureGrad textureGradOffset '
            + 'textureLod textureLodOffset textureOffset textureProj textureProjGrad textureProjGradOffset '
            + 'textureProjLod textureProjLodOffset textureProjOffset textureQueryLevels textureQueryLod '
            + 'textureSize transpose trunc uaddCarry uintBitsToFloat umulExtended unpackDouble2x32 '
            + 'unpackHalf2x16 unpackSnorm2x16 unpackSnorm4x8 unpackUnorm2x16 unpackUnorm4x8 usubBorrow',
          literal: 'true false'
        },
        illegal: '"',
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.C_NUMBER_MODE,
          {
            className: 'meta',
            begin: '#',
            end: '$'
          }
        ]
      };
    }

    /*
    Language: Go
    Author: Stephan Kountso aka StepLg <steplg@gmail.com>
    Contributors: Evgeny Stepanischev <imbolk@gmail.com>
    Description: Google go language (golang). For info about language
    Website: http://golang.org/
    Category: common, system
    */

    function go(hljs) {
      const LITERALS = [
        "true",
        "false",
        "iota",
        "nil"
      ];
      const BUILT_INS = [
        "append",
        "cap",
        "close",
        "complex",
        "copy",
        "imag",
        "len",
        "make",
        "new",
        "panic",
        "print",
        "println",
        "real",
        "recover",
        "delete"
      ];
      const TYPES = [
        "bool",
        "byte",
        "complex64",
        "complex128",
        "error",
        "float32",
        "float64",
        "int8",
        "int16",
        "int32",
        "int64",
        "string",
        "uint8",
        "uint16",
        "uint32",
        "uint64",
        "int",
        "uint",
        "uintptr",
        "rune"
      ];
      const KWS = [
        "break",
        "case",
        "chan",
        "const",
        "continue",
        "default",
        "defer",
        "else",
        "fallthrough",
        "for",
        "func",
        "go",
        "goto",
        "if",
        "import",
        "interface",
        "map",
        "package",
        "range",
        "return",
        "select",
        "struct",
        "switch",
        "type",
        "var",
      ];
      const KEYWORDS = {
        keyword: KWS,
        type: TYPES,
        literal: LITERALS,
        built_in: BUILT_INS
      };
      return {
        name: 'Go',
        aliases: [ 'golang' ],
        keywords: KEYWORDS,
        illegal: '</',
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          {
            className: 'string',
            variants: [
              hljs.QUOTE_STRING_MODE,
              hljs.APOS_STRING_MODE,
              {
                begin: '`',
                end: '`'
              }
            ]
          },
          {
            className: 'number',
            variants: [
              {
                begin: hljs.C_NUMBER_RE + '[i]',
                relevance: 1
              },
              hljs.C_NUMBER_MODE
            ]
          },
          { begin: /:=/ // relevance booster
          },
          {
            className: 'function',
            beginKeywords: 'func',
            end: '\\s*(\\{|$)',
            excludeEnd: true,
            contains: [
              hljs.TITLE_MODE,
              {
                className: 'params',
                begin: /\(/,
                end: /\)/,
                endsParent: true,
                keywords: KEYWORDS,
                illegal: /["']/
              }
            ]
          }
        ]
      };
    }

    /*
    Language: Gradle
    Description: Gradle is an open-source build automation tool focused on flexibility and performance.
    Website: https://gradle.org
    Author: Damian Mee <mee.damian@gmail.com>
    */

    function gradle(hljs) {
      const KEYWORDS = [
        "task",
        "project",
        "allprojects",
        "subprojects",
        "artifacts",
        "buildscript",
        "configurations",
        "dependencies",
        "repositories",
        "sourceSets",
        "description",
        "delete",
        "from",
        "into",
        "include",
        "exclude",
        "source",
        "classpath",
        "destinationDir",
        "includes",
        "options",
        "sourceCompatibility",
        "targetCompatibility",
        "group",
        "flatDir",
        "doLast",
        "doFirst",
        "flatten",
        "todir",
        "fromdir",
        "ant",
        "def",
        "abstract",
        "break",
        "case",
        "catch",
        "continue",
        "default",
        "do",
        "else",
        "extends",
        "final",
        "finally",
        "for",
        "if",
        "implements",
        "instanceof",
        "native",
        "new",
        "private",
        "protected",
        "public",
        "return",
        "static",
        "switch",
        "synchronized",
        "throw",
        "throws",
        "transient",
        "try",
        "volatile",
        "while",
        "strictfp",
        "package",
        "import",
        "false",
        "null",
        "super",
        "this",
        "true",
        "antlrtask",
        "checkstyle",
        "codenarc",
        "copy",
        "boolean",
        "byte",
        "char",
        "class",
        "double",
        "float",
        "int",
        "interface",
        "long",
        "short",
        "void",
        "compile",
        "runTime",
        "file",
        "fileTree",
        "abs",
        "any",
        "append",
        "asList",
        "asWritable",
        "call",
        "collect",
        "compareTo",
        "count",
        "div",
        "dump",
        "each",
        "eachByte",
        "eachFile",
        "eachLine",
        "every",
        "find",
        "findAll",
        "flatten",
        "getAt",
        "getErr",
        "getIn",
        "getOut",
        "getText",
        "grep",
        "immutable",
        "inject",
        "inspect",
        "intersect",
        "invokeMethods",
        "isCase",
        "join",
        "leftShift",
        "minus",
        "multiply",
        "newInputStream",
        "newOutputStream",
        "newPrintWriter",
        "newReader",
        "newWriter",
        "next",
        "plus",
        "pop",
        "power",
        "previous",
        "print",
        "println",
        "push",
        "putAt",
        "read",
        "readBytes",
        "readLines",
        "reverse",
        "reverseEach",
        "round",
        "size",
        "sort",
        "splitEachLine",
        "step",
        "subMap",
        "times",
        "toInteger",
        "toList",
        "tokenize",
        "upto",
        "waitForOrKill",
        "withPrintWriter",
        "withReader",
        "withStream",
        "withWriter",
        "withWriterAppend",
        "write",
        "writeLine"
      ];
      return {
        name: 'Gradle',
        case_insensitive: true,
        keywords: KEYWORDS,
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE,
          hljs.NUMBER_MODE,
          hljs.REGEXP_MODE

        ]
      };
    }

    /*
     Language: GraphQL
     Author: John Foster (GH jf990), and others
     Description: GraphQL is a query language for APIs
     Category: web, common
    */

    /** @type LanguageFn */
    function graphql(hljs) {
      const regex = hljs.regex;
      const GQL_NAME = /[_A-Za-z][_0-9A-Za-z]*/;
      return {
        name: "GraphQL",
        aliases: [ "gql" ],
        case_insensitive: true,
        disableAutodetect: false,
        keywords: {
          keyword: [
            "query",
            "mutation",
            "subscription",
            "type",
            "input",
            "schema",
            "directive",
            "interface",
            "union",
            "scalar",
            "fragment",
            "enum",
            "on"
          ],
          literal: [
            "true",
            "false",
            "null"
          ]
        },
        contains: [
          hljs.HASH_COMMENT_MODE,
          hljs.QUOTE_STRING_MODE,
          hljs.NUMBER_MODE,
          {
            scope: "punctuation",
            match: /[.]{3}/,
            relevance: 0
          },
          {
            scope: "punctuation",
            begin: /[\!\(\)\:\=\[\]\{\|\}]{1}/,
            relevance: 0
          },
          {
            scope: "variable",
            begin: /\$/,
            end: /\W/,
            excludeEnd: true,
            relevance: 0
          },
          {
            scope: "meta",
            match: /@\w+/,
            excludeEnd: true
          },
          {
            scope: "symbol",
            begin: regex.concat(GQL_NAME, regex.lookahead(/\s*:/)),
            relevance: 0
          }
        ],
        illegal: [
          /[;<']/,
          /BEGIN/
        ]
      };
    }

    /*
     Language: Groovy
     Author: Guillaume Laforge <glaforge@gmail.com>
     Description: Groovy programming language implementation inspired from Vsevolod's Java mode
     Website: https://groovy-lang.org
     */

    function variants(variants, obj = {}) {
      obj.variants = variants;
      return obj;
    }

    function groovy(hljs) {
      const regex = hljs.regex;
      const IDENT_RE = '[A-Za-z0-9_$]+';
      const COMMENT = variants([
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        hljs.COMMENT(
          '/\\*\\*',
          '\\*/',
          {
            relevance: 0,
            contains: [
              {
                // eat up @'s in emails to prevent them to be recognized as doctags
                begin: /\w+@/,
                relevance: 0
              },
              {
                className: 'doctag',
                begin: '@[A-Za-z]+'
              }
            ]
          }
        )
      ]);
      const REGEXP = {
        className: 'regexp',
        begin: /~?\/[^\/\n]+\//,
        contains: [ hljs.BACKSLASH_ESCAPE ]
      };
      const NUMBER = variants([
        hljs.BINARY_NUMBER_MODE,
        hljs.C_NUMBER_MODE
      ]);
      const STRING = variants([
        {
          begin: /"""/,
          end: /"""/
        },
        {
          begin: /'''/,
          end: /'''/
        },
        {
          begin: "\\$/",
          end: "/\\$",
          relevance: 10
        },
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE
      ],
      { className: "string" }
      );

      const CLASS_DEFINITION = {
        match: [
          /(class|interface|trait|enum|extends|implements)/,
          /\s+/,
          hljs.UNDERSCORE_IDENT_RE
        ],
        scope: {
          1: "keyword",
          3: "title.class",
        }
      };
      const TYPES = [
        "byte",
        "short",
        "char",
        "int",
        "long",
        "boolean",
        "float",
        "double",
        "void"
      ];
      const KEYWORDS = [
        // groovy specific keywords
        "def",
        "as",
        "in",
        "assert",
        "trait",
        // common keywords with Java
        "abstract",
        "static",
        "volatile",
        "transient",
        "public",
        "private",
        "protected",
        "synchronized",
        "final",
        "class",
        "interface",
        "enum",
        "if",
        "else",
        "for",
        "while",
        "switch",
        "case",
        "break",
        "default",
        "continue",
        "throw",
        "throws",
        "try",
        "catch",
        "finally",
        "implements",
        "extends",
        "new",
        "import",
        "package",
        "return",
        "instanceof"
      ];

      return {
        name: 'Groovy',
        keywords: {
          "variable.language": 'this super',
          literal: 'true false null',
          type: TYPES,
          keyword: KEYWORDS
        },
        contains: [
          hljs.SHEBANG({
            binary: "groovy",
            relevance: 10
          }),
          COMMENT,
          STRING,
          REGEXP,
          NUMBER,
          CLASS_DEFINITION,
          {
            className: 'meta',
            begin: '@[A-Za-z]+',
            relevance: 0
          },
          {
            // highlight map keys and named parameters as attrs
            className: 'attr',
            begin: IDENT_RE + '[ \t]*:',
            relevance: 0
          },
          {
            // catch middle element of the ternary operator
            // to avoid highlight it as a label, named parameter, or map key
            begin: /\?/,
            end: /:/,
            relevance: 0,
            contains: [
              COMMENT,
              STRING,
              REGEXP,
              NUMBER,
              'self'
            ]
          },
          {
            // highlight labeled statements
            className: 'symbol',
            begin: '^[ \t]*' + regex.lookahead(IDENT_RE + ':'),
            excludeBegin: true,
            end: IDENT_RE + ':',
            relevance: 0
          }
        ],
        illegal: /#|<\//
      };
    }

    /*
    Language: Haskell
    Author: Jeremy Hull <sourdrums@gmail.com>
    Contributors: Zena Treep <zena.treep@gmail.com>
    Website: https://www.haskell.org
    Category: functional
    */

    function haskell(hljs) {
      const COMMENT = { variants: [
        hljs.COMMENT('--', '$'),
        hljs.COMMENT(
          /\{-/,
          /-\}/,
          { contains: [ 'self' ] }
        )
      ] };

      const PRAGMA = {
        className: 'meta',
        begin: /\{-#/,
        end: /#-\}/
      };

      const PREPROCESSOR = {
        className: 'meta',
        begin: '^#',
        end: '$'
      };

      const CONSTRUCTOR = {
        className: 'type',
        begin: '\\b[A-Z][\\w\']*', // TODO: other constructors (build-in, infix).
        relevance: 0
      };

      const LIST = {
        begin: '\\(',
        end: '\\)',
        illegal: '"',
        contains: [
          PRAGMA,
          PREPROCESSOR,
          {
            className: 'type',
            begin: '\\b[A-Z][\\w]*(\\((\\.\\.|,|\\w+)\\))?'
          },
          hljs.inherit(hljs.TITLE_MODE, { begin: '[_a-z][\\w\']*' }),
          COMMENT
        ]
      };

      const RECORD = {
        begin: /\{/,
        end: /\}/,
        contains: LIST.contains
      };

      /* See:

         - https://www.haskell.org/onlinereport/lexemes.html
         - https://downloads.haskell.org/ghc/9.0.1/docs/html/users_guide/exts/binary_literals.html
         - https://downloads.haskell.org/ghc/9.0.1/docs/html/users_guide/exts/numeric_underscores.html
         - https://downloads.haskell.org/ghc/9.0.1/docs/html/users_guide/exts/hex_float_literals.html

      */
      const decimalDigits = '([0-9]_*)+';
      const hexDigits = '([0-9a-fA-F]_*)+';
      const binaryDigits = '([01]_*)+';
      const octalDigits = '([0-7]_*)+';

      const NUMBER = {
        className: 'number',
        relevance: 0,
        variants: [
          // decimal floating-point-literal (subsumes decimal-literal)
          { match: `\\b(${decimalDigits})(\\.(${decimalDigits}))?` + `([eE][+-]?(${decimalDigits}))?\\b` },
          // hexadecimal floating-point-literal (subsumes hexadecimal-literal)
          { match: `\\b0[xX]_*(${hexDigits})(\\.(${hexDigits}))?` + `([pP][+-]?(${decimalDigits}))?\\b` },
          // octal-literal
          { match: `\\b0[oO](${octalDigits})\\b` },
          // binary-literal
          { match: `\\b0[bB](${binaryDigits})\\b` }
        ]
      };

      return {
        name: 'Haskell',
        aliases: [ 'hs' ],
        keywords:
          'let in if then else case of where do module import hiding '
          + 'qualified type data newtype deriving class instance as default '
          + 'infix infixl infixr foreign export ccall stdcall cplusplus '
          + 'jvm dotnet safe unsafe family forall mdo proc rec',
        contains: [
          // Top-level constructions.
          {
            beginKeywords: 'module',
            end: 'where',
            keywords: 'module where',
            contains: [
              LIST,
              COMMENT
            ],
            illegal: '\\W\\.|;'
          },
          {
            begin: '\\bimport\\b',
            end: '$',
            keywords: 'import qualified as hiding',
            contains: [
              LIST,
              COMMENT
            ],
            illegal: '\\W\\.|;'
          },
          {
            className: 'class',
            begin: '^(\\s*)?(class|instance)\\b',
            end: 'where',
            keywords: 'class family instance where',
            contains: [
              CONSTRUCTOR,
              LIST,
              COMMENT
            ]
          },
          {
            className: 'class',
            begin: '\\b(data|(new)?type)\\b',
            end: '$',
            keywords: 'data family type newtype deriving',
            contains: [
              PRAGMA,
              CONSTRUCTOR,
              LIST,
              RECORD,
              COMMENT
            ]
          },
          {
            beginKeywords: 'default',
            end: '$',
            contains: [
              CONSTRUCTOR,
              LIST,
              COMMENT
            ]
          },
          {
            beginKeywords: 'infix infixl infixr',
            end: '$',
            contains: [
              hljs.C_NUMBER_MODE,
              COMMENT
            ]
          },
          {
            begin: '\\bforeign\\b',
            end: '$',
            keywords: 'foreign import export ccall stdcall cplusplus jvm '
                      + 'dotnet safe unsafe',
            contains: [
              CONSTRUCTOR,
              hljs.QUOTE_STRING_MODE,
              COMMENT
            ]
          },
          {
            className: 'meta',
            begin: '#!\\/usr\\/bin\\/env\ runhaskell',
            end: '$'
          },
          // "Whitespaces".
          PRAGMA,
          PREPROCESSOR,

          // Literals and names.

          // TODO: characters.
          hljs.QUOTE_STRING_MODE,
          NUMBER,
          CONSTRUCTOR,
          hljs.inherit(hljs.TITLE_MODE, { begin: '^[_a-z][\\w\']*' }),
          COMMENT,
          { // No markup, relevance booster
            begin: '->|<-' }
        ]
      };
    }

    /*
    Language: Haxe
    Description: Haxe is an open source toolkit based on a modern, high level, strictly typed programming language.
    Author: Christopher Kaster <ikasoki@gmail.com> (Based on the actionscript.js language file by Alexander Myadzel)
    Contributors: Kenton Hamaluik <kentonh@gmail.com>
    Website: https://haxe.org
    */

    function haxe(hljs) {

      const HAXE_BASIC_TYPES = 'Int Float String Bool Dynamic Void Array ';

      return {
        name: 'Haxe',
        aliases: [ 'hx' ],
        keywords: {
          keyword: 'break case cast catch continue default do dynamic else enum extern '
                   + 'for function here if import in inline never new override package private get set '
                   + 'public return static super switch this throw trace try typedef untyped using var while '
                   + HAXE_BASIC_TYPES,
          built_in:
            'trace this',
          literal:
            'true false null _'
        },
        contains: [
          {
            className: 'string', // interpolate-able strings
            begin: '\'',
            end: '\'',
            contains: [
              hljs.BACKSLASH_ESCAPE,
              {
                className: 'subst', // interpolation
                begin: '\\$\\{',
                end: '\\}'
              },
              {
                className: 'subst', // interpolation
                begin: '\\$',
                end: /\W\}/
              }
            ]
          },
          hljs.QUOTE_STRING_MODE,
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.C_NUMBER_MODE,
          {
            className: 'meta', // compiler meta
            begin: '@:',
            end: '$'
          },
          {
            className: 'meta', // compiler conditionals
            begin: '#',
            end: '$',
            keywords: { keyword: 'if else elseif end error' }
          },
          {
            className: 'type', // function types
            begin: ':[ \t]*',
            end: '[^A-Za-z0-9_ \t\\->]',
            excludeBegin: true,
            excludeEnd: true,
            relevance: 0
          },
          {
            className: 'type', // types
            begin: ':[ \t]*',
            end: '\\W',
            excludeBegin: true,
            excludeEnd: true
          },
          {
            className: 'type', // instantiation
            begin: 'new *',
            end: '\\W',
            excludeBegin: true,
            excludeEnd: true
          },
          {
            className: 'class', // enums
            beginKeywords: 'enum',
            end: '\\{',
            contains: [ hljs.TITLE_MODE ]
          },
          {
            className: 'class', // abstracts
            beginKeywords: 'abstract',
            end: '[\\{$]',
            contains: [
              {
                className: 'type',
                begin: '\\(',
                end: '\\)',
                excludeBegin: true,
                excludeEnd: true
              },
              {
                className: 'type',
                begin: 'from +',
                end: '\\W',
                excludeBegin: true,
                excludeEnd: true
              },
              {
                className: 'type',
                begin: 'to +',
                end: '\\W',
                excludeBegin: true,
                excludeEnd: true
              },
              hljs.TITLE_MODE
            ],
            keywords: { keyword: 'abstract from to' }
          },
          {
            className: 'class', // classes
            begin: '\\b(class|interface) +',
            end: '[\\{$]',
            excludeEnd: true,
            keywords: 'class interface',
            contains: [
              {
                className: 'keyword',
                begin: '\\b(extends|implements) +',
                keywords: 'extends implements',
                contains: [
                  {
                    className: 'type',
                    begin: hljs.IDENT_RE,
                    relevance: 0
                  }
                ]
              },
              hljs.TITLE_MODE
            ]
          },
          {
            className: 'function',
            beginKeywords: 'function',
            end: '\\(',
            excludeEnd: true,
            illegal: '\\S',
            contains: [ hljs.TITLE_MODE ]
          }
        ],
        illegal: /<\//
      };
    }

    // https://docs.oracle.com/javase/specs/jls/se15/html/jls-3.html#jls-3.10
    var decimalDigits = '[0-9](_*[0-9])*';
    var frac = `\\.(${decimalDigits})`;
    var hexDigits = '[0-9a-fA-F](_*[0-9a-fA-F])*';
    var NUMERIC = {
      className: 'number',
      variants: [
        // DecimalFloatingPointLiteral
        // including ExponentPart
        { begin: `(\\b(${decimalDigits})((${frac})|\\.)?|(${frac}))` +
          `[eE][+-]?(${decimalDigits})[fFdD]?\\b` },
        // excluding ExponentPart
        { begin: `\\b(${decimalDigits})((${frac})[fFdD]?\\b|\\.([fFdD]\\b)?)` },
        { begin: `(${frac})[fFdD]?\\b` },
        { begin: `\\b(${decimalDigits})[fFdD]\\b` },

        // HexadecimalFloatingPointLiteral
        { begin: `\\b0[xX]((${hexDigits})\\.?|(${hexDigits})?\\.(${hexDigits}))` +
          `[pP][+-]?(${decimalDigits})[fFdD]?\\b` },

        // DecimalIntegerLiteral
        { begin: '\\b(0|[1-9](_*[0-9])*)[lL]?\\b' },

        // HexIntegerLiteral
        { begin: `\\b0[xX](${hexDigits})[lL]?\\b` },

        // OctalIntegerLiteral
        { begin: '\\b0(_*[0-7])*[lL]?\\b' },

        // BinaryIntegerLiteral
        { begin: '\\b0[bB][01](_*[01])*[lL]?\\b' },
      ],
      relevance: 0
    };

    /*
    Language: Java
    Author: Vsevolod Solovyov <vsevolod.solovyov@gmail.com>
    Category: common, enterprise
    Website: https://www.java.com/
    */

    /**
     * Allows recursive regex expressions to a given depth
     *
     * ie: recurRegex("(abc~~~)", /~~~/g, 2) becomes:
     * (abc(abc(abc)))
     *
     * @param {string} re
     * @param {RegExp} substitution (should be a g mode regex)
     * @param {number} depth
     * @returns {string}``
     */
    function recurRegex(re, substitution, depth) {
      if (depth === -1) return "";

      return re.replace(substitution, _ => {
        return recurRegex(re, substitution, depth - 1);
      });
    }

    /** @type LanguageFn */
    function java(hljs) {
      const regex = hljs.regex;
      const JAVA_IDENT_RE = '[\u00C0-\u02B8a-zA-Z_$][\u00C0-\u02B8a-zA-Z_$0-9]*';
      const GENERIC_IDENT_RE = JAVA_IDENT_RE
        + recurRegex('(?:<' + JAVA_IDENT_RE + '~~~(?:\\s*,\\s*' + JAVA_IDENT_RE + '~~~)*>)?', /~~~/g, 2);
      const MAIN_KEYWORDS = [
        'synchronized',
        'abstract',
        'private',
        'var',
        'static',
        'if',
        'const ',
        'for',
        'while',
        'strictfp',
        'finally',
        'protected',
        'import',
        'native',
        'final',
        'void',
        'enum',
        'else',
        'break',
        'transient',
        'catch',
        'instanceof',
        'volatile',
        'case',
        'assert',
        'package',
        'default',
        'public',
        'try',
        'switch',
        'continue',
        'throws',
        'protected',
        'public',
        'private',
        'module',
        'requires',
        'exports',
        'do',
        'sealed',
        'yield',
        'permits'
      ];

      const BUILT_INS = [
        'super',
        'this'
      ];

      const LITERALS = [
        'false',
        'true',
        'null'
      ];

      const TYPES = [
        'char',
        'boolean',
        'long',
        'float',
        'int',
        'byte',
        'short',
        'double'
      ];

      const KEYWORDS = {
        keyword: MAIN_KEYWORDS,
        literal: LITERALS,
        type: TYPES,
        built_in: BUILT_INS
      };

      const ANNOTATION = {
        className: 'meta',
        begin: '@' + JAVA_IDENT_RE,
        contains: [
          {
            begin: /\(/,
            end: /\)/,
            contains: [ "self" ] // allow nested () inside our annotation
          }
        ]
      };
      const PARAMS = {
        className: 'params',
        begin: /\(/,
        end: /\)/,
        keywords: KEYWORDS,
        relevance: 0,
        contains: [ hljs.C_BLOCK_COMMENT_MODE ],
        endsParent: true
      };

      return {
        name: 'Java',
        aliases: [ 'jsp' ],
        keywords: KEYWORDS,
        illegal: /<\/|#/,
        contains: [
          hljs.COMMENT(
            '/\\*\\*',
            '\\*/',
            {
              relevance: 0,
              contains: [
                {
                  // eat up @'s in emails to prevent them to be recognized as doctags
                  begin: /\w+@/,
                  relevance: 0
                },
                {
                  className: 'doctag',
                  begin: '@[A-Za-z]+'
                }
              ]
            }
          ),
          // relevance boost
          {
            begin: /import java\.[a-z]+\./,
            keywords: "import",
            relevance: 2
          },
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          {
            begin: /"""/,
            end: /"""/,
            className: "string",
            contains: [ hljs.BACKSLASH_ESCAPE ]
          },
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE,
          {
            match: [
              /\b(?:class|interface|enum|extends|implements|new)/,
              /\s+/,
              JAVA_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "title.class"
            }
          },
          {
            // Exceptions for hyphenated keywords
            match: /non-sealed/,
            scope: "keyword"
          },
          {
            begin: [
              regex.concat(/(?!else)/, JAVA_IDENT_RE),
              /\s+/,
              JAVA_IDENT_RE,
              /\s+/,
              /=(?!=)/
            ],
            className: {
              1: "type",
              3: "variable",
              5: "operator"
            }
          },
          {
            begin: [
              /record/,
              /\s+/,
              JAVA_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "title.class"
            },
            contains: [
              PARAMS,
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          {
            // Expression keywords prevent 'keyword Name(...)' from being
            // recognized as a function definition
            beginKeywords: 'new throw return else',
            relevance: 0
          },
          {
            begin: [
              '(?:' + GENERIC_IDENT_RE + '\\s+)',
              hljs.UNDERSCORE_IDENT_RE,
              /\s*(?=\()/
            ],
            className: { 2: "title.function" },
            keywords: KEYWORDS,
            contains: [
              {
                className: 'params',
                begin: /\(/,
                end: /\)/,
                keywords: KEYWORDS,
                relevance: 0,
                contains: [
                  ANNOTATION,
                  hljs.APOS_STRING_MODE,
                  hljs.QUOTE_STRING_MODE,
                  NUMERIC,
                  hljs.C_BLOCK_COMMENT_MODE
                ]
              },
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          NUMERIC,
          ANNOTATION
        ]
      };
    }

    const IDENT_RE = '[A-Za-z$_][0-9A-Za-z$_]*';
    const KEYWORDS = [
      "as", // for exports
      "in",
      "of",
      "if",
      "for",
      "while",
      "finally",
      "var",
      "new",
      "function",
      "do",
      "return",
      "void",
      "else",
      "break",
      "catch",
      "instanceof",
      "with",
      "throw",
      "case",
      "default",
      "try",
      "switch",
      "continue",
      "typeof",
      "delete",
      "let",
      "yield",
      "const",
      "class",
      // JS handles these with a special rule
      // "get",
      // "set",
      "debugger",
      "async",
      "await",
      "static",
      "import",
      "from",
      "export",
      "extends"
    ];
    const LITERALS = [
      "true",
      "false",
      "null",
      "undefined",
      "NaN",
      "Infinity"
    ];

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
    const TYPES = [
      // Fundamental objects
      "Object",
      "Function",
      "Boolean",
      "Symbol",
      // numbers and dates
      "Math",
      "Date",
      "Number",
      "BigInt",
      // text
      "String",
      "RegExp",
      // Indexed collections
      "Array",
      "Float32Array",
      "Float64Array",
      "Int8Array",
      "Uint8Array",
      "Uint8ClampedArray",
      "Int16Array",
      "Int32Array",
      "Uint16Array",
      "Uint32Array",
      "BigInt64Array",
      "BigUint64Array",
      // Keyed collections
      "Set",
      "Map",
      "WeakSet",
      "WeakMap",
      // Structured data
      "ArrayBuffer",
      "SharedArrayBuffer",
      "Atomics",
      "DataView",
      "JSON",
      // Control abstraction objects
      "Promise",
      "Generator",
      "GeneratorFunction",
      "AsyncFunction",
      // Reflection
      "Reflect",
      "Proxy",
      // Internationalization
      "Intl",
      // WebAssembly
      "WebAssembly"
    ];

    const ERROR_TYPES = [
      "Error",
      "EvalError",
      "InternalError",
      "RangeError",
      "ReferenceError",
      "SyntaxError",
      "TypeError",
      "URIError"
    ];

    const BUILT_IN_GLOBALS = [
      "setInterval",
      "setTimeout",
      "clearInterval",
      "clearTimeout",

      "require",
      "exports",

      "eval",
      "isFinite",
      "isNaN",
      "parseFloat",
      "parseInt",
      "decodeURI",
      "decodeURIComponent",
      "encodeURI",
      "encodeURIComponent",
      "escape",
      "unescape"
    ];

    const BUILT_IN_VARIABLES = [
      "arguments",
      "this",
      "super",
      "console",
      "window",
      "document",
      "localStorage",
      "sessionStorage",
      "module",
      "global" // Node.js
    ];

    const BUILT_INS = [].concat(
      BUILT_IN_GLOBALS,
      TYPES,
      ERROR_TYPES
    );

    /*
    Language: JavaScript
    Description: JavaScript (JS) is a lightweight, interpreted, or just-in-time compiled programming language with first-class functions.
    Category: common, scripting, web
    Website: https://developer.mozilla.org/en-US/docs/Web/JavaScript
    */

    /** @type LanguageFn */
    function javascript(hljs) {
      const regex = hljs.regex;
      /**
       * Takes a string like "<Booger" and checks to see
       * if we can find a matching "</Booger" later in the
       * content.
       * @param {RegExpMatchArray} match
       * @param {{after:number}} param1
       */
      const hasClosingTag = (match, { after }) => {
        const tag = "</" + match[0].slice(1);
        const pos = match.input.indexOf(tag, after);
        return pos !== -1;
      };

      const IDENT_RE$1 = IDENT_RE;
      const FRAGMENT = {
        begin: '<>',
        end: '</>'
      };
      // to avoid some special cases inside isTrulyOpeningTag
      const XML_SELF_CLOSING = /<[A-Za-z0-9\\._:-]+\s*\/>/;
      const XML_TAG = {
        begin: /<[A-Za-z0-9\\._:-]+/,
        end: /\/[A-Za-z0-9\\._:-]+>|\/>/,
        /**
         * @param {RegExpMatchArray} match
         * @param {CallbackResponse} response
         */
        isTrulyOpeningTag: (match, response) => {
          const afterMatchIndex = match[0].length + match.index;
          const nextChar = match.input[afterMatchIndex];
          if (
            // HTML should not include another raw `<` inside a tag
            // nested type?
            // `<Array<Array<number>>`, etc.
            nextChar === "<" ||
            // the , gives away that this is not HTML
            // `<T, A extends keyof T, V>`
            nextChar === ","
            ) {
            response.ignoreMatch();
            return;
          }

          // `<something>`
          // Quite possibly a tag, lets look for a matching closing tag...
          if (nextChar === ">") {
            // if we cannot find a matching closing tag, then we
            // will ignore it
            if (!hasClosingTag(match, { after: afterMatchIndex })) {
              response.ignoreMatch();
            }
          }

          // `<blah />` (self-closing)
          // handled by simpleSelfClosing rule

          let m;
          const afterMatch = match.input.substring(afterMatchIndex);

          // some more template typing stuff
          //  <T = any>(key?: string) => Modify<
          if ((m = afterMatch.match(/^\s*=/))) {
            response.ignoreMatch();
            return;
          }

          // `<From extends string>`
          // technically this could be HTML, but it smells like a type
          // NOTE: This is ugh, but added specifically for https://github.com/highlightjs/highlight.js/issues/3276
          if ((m = afterMatch.match(/^\s+extends\s+/))) {
            if (m.index === 0) {
              response.ignoreMatch();
              // eslint-disable-next-line no-useless-return
              return;
            }
          }
        }
      };
      const KEYWORDS$1 = {
        $pattern: IDENT_RE,
        keyword: KEYWORDS,
        literal: LITERALS,
        built_in: BUILT_INS,
        "variable.language": BUILT_IN_VARIABLES
      };

      // https://tc39.es/ecma262/#sec-literals-numeric-literals
      const decimalDigits = '[0-9](_?[0-9])*';
      const frac = `\\.(${decimalDigits})`;
      // DecimalIntegerLiteral, including Annex B NonOctalDecimalIntegerLiteral
      // https://tc39.es/ecma262/#sec-additional-syntax-numeric-literals
      const decimalInteger = `0|[1-9](_?[0-9])*|0[0-7]*[89][0-9]*`;
      const NUMBER = {
        className: 'number',
        variants: [
          // DecimalLiteral
          { begin: `(\\b(${decimalInteger})((${frac})|\\.)?|(${frac}))` +
            `[eE][+-]?(${decimalDigits})\\b` },
          { begin: `\\b(${decimalInteger})\\b((${frac})\\b|\\.)?|(${frac})\\b` },

          // DecimalBigIntegerLiteral
          { begin: `\\b(0|[1-9](_?[0-9])*)n\\b` },

          // NonDecimalIntegerLiteral
          { begin: "\\b0[xX][0-9a-fA-F](_?[0-9a-fA-F])*n?\\b" },
          { begin: "\\b0[bB][0-1](_?[0-1])*n?\\b" },
          { begin: "\\b0[oO][0-7](_?[0-7])*n?\\b" },

          // LegacyOctalIntegerLiteral (does not include underscore separators)
          // https://tc39.es/ecma262/#sec-additional-syntax-numeric-literals
          { begin: "\\b0[0-7]+n?\\b" },
        ],
        relevance: 0
      };

      const SUBST = {
        className: 'subst',
        begin: '\\$\\{',
        end: '\\}',
        keywords: KEYWORDS$1,
        contains: [] // defined later
      };
      const HTML_TEMPLATE = {
        begin: 'html`',
        end: '',
        starts: {
          end: '`',
          returnEnd: false,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST
          ],
          subLanguage: 'xml'
        }
      };
      const CSS_TEMPLATE = {
        begin: 'css`',
        end: '',
        starts: {
          end: '`',
          returnEnd: false,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST
          ],
          subLanguage: 'css'
        }
      };
      const GRAPHQL_TEMPLATE = {
        begin: 'gql`',
        end: '',
        starts: {
          end: '`',
          returnEnd: false,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST
          ],
          subLanguage: 'graphql'
        }
      };
      const TEMPLATE_STRING = {
        className: 'string',
        begin: '`',
        end: '`',
        contains: [
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ]
      };
      const JSDOC_COMMENT = hljs.COMMENT(
        /\/\*\*(?!\/)/,
        '\\*/',
        {
          relevance: 0,
          contains: [
            {
              begin: '(?=@[A-Za-z]+)',
              relevance: 0,
              contains: [
                {
                  className: 'doctag',
                  begin: '@[A-Za-z]+'
                },
                {
                  className: 'type',
                  begin: '\\{',
                  end: '\\}',
                  excludeEnd: true,
                  excludeBegin: true,
                  relevance: 0
                },
                {
                  className: 'variable',
                  begin: IDENT_RE$1 + '(?=\\s*(-)|$)',
                  endsParent: true,
                  relevance: 0
                },
                // eat spaces (not newlines) so we can find
                // types or variables
                {
                  begin: /(?=[^\n])\s/,
                  relevance: 0
                }
              ]
            }
          ]
        }
      );
      const COMMENT = {
        className: "comment",
        variants: [
          JSDOC_COMMENT,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.C_LINE_COMMENT_MODE
        ]
      };
      const SUBST_INTERNALS = [
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE,
        HTML_TEMPLATE,
        CSS_TEMPLATE,
        GRAPHQL_TEMPLATE,
        TEMPLATE_STRING,
        // Skip numbers when they are part of a variable name
        { match: /\$\d+/ },
        NUMBER,
        // This is intentional:
        // See https://github.com/highlightjs/highlight.js/issues/3288
        // hljs.REGEXP_MODE
      ];
      SUBST.contains = SUBST_INTERNALS
        .concat({
          // we need to pair up {} inside our subst to prevent
          // it from ending too early by matching another }
          begin: /\{/,
          end: /\}/,
          keywords: KEYWORDS$1,
          contains: [
            "self"
          ].concat(SUBST_INTERNALS)
        });
      const SUBST_AND_COMMENTS = [].concat(COMMENT, SUBST.contains);
      const PARAMS_CONTAINS = SUBST_AND_COMMENTS.concat([
        // eat recursive parens in sub expressions
        {
          begin: /\(/,
          end: /\)/,
          keywords: KEYWORDS$1,
          contains: ["self"].concat(SUBST_AND_COMMENTS)
        }
      ]);
      const PARAMS = {
        className: 'params',
        begin: /\(/,
        end: /\)/,
        excludeBegin: true,
        excludeEnd: true,
        keywords: KEYWORDS$1,
        contains: PARAMS_CONTAINS
      };

      // ES6 classes
      const CLASS_OR_EXTENDS = {
        variants: [
          // class Car extends vehicle
          {
            match: [
              /class/,
              /\s+/,
              IDENT_RE$1,
              /\s+/,
              /extends/,
              /\s+/,
              regex.concat(IDENT_RE$1, "(", regex.concat(/\./, IDENT_RE$1), ")*")
            ],
            scope: {
              1: "keyword",
              3: "title.class",
              5: "keyword",
              7: "title.class.inherited"
            }
          },
          // class Car
          {
            match: [
              /class/,
              /\s+/,
              IDENT_RE$1
            ],
            scope: {
              1: "keyword",
              3: "title.class"
            }
          },

        ]
      };

      const CLASS_REFERENCE = {
        relevance: 0,
        match:
        regex.either(
          // Hard coded exceptions
          /\bJSON/,
          // Float32Array, OutT
          /\b[A-Z][a-z]+([A-Z][a-z]*|\d)*/,
          // CSSFactory, CSSFactoryT
          /\b[A-Z]{2,}([A-Z][a-z]+|\d)+([A-Z][a-z]*)*/,
          // FPs, FPsT
          /\b[A-Z]{2,}[a-z]+([A-Z][a-z]+|\d)*([A-Z][a-z]*)*/,
          // P
          // single letters are not highlighted
          // BLAH
          // this will be flagged as a UPPER_CASE_CONSTANT instead
        ),
        className: "title.class",
        keywords: {
          _: [
            // se we still get relevance credit for JS library classes
            ...TYPES,
            ...ERROR_TYPES
          ]
        }
      };

      const USE_STRICT = {
        label: "use_strict",
        className: 'meta',
        relevance: 10,
        begin: /^\s*['"]use (strict|asm)['"]/
      };

      const FUNCTION_DEFINITION = {
        variants: [
          {
            match: [
              /function/,
              /\s+/,
              IDENT_RE$1,
              /(?=\s*\()/
            ]
          },
          // anonymous function
          {
            match: [
              /function/,
              /\s*(?=\()/
            ]
          }
        ],
        className: {
          1: "keyword",
          3: "title.function"
        },
        label: "func.def",
        contains: [ PARAMS ],
        illegal: /%/
      };

      const UPPER_CASE_CONSTANT = {
        relevance: 0,
        match: /\b[A-Z][A-Z_0-9]+\b/,
        className: "variable.constant"
      };

      function noneOf(list) {
        return regex.concat("(?!", list.join("|"), ")");
      }

      const FUNCTION_CALL = {
        match: regex.concat(
          /\b/,
          noneOf([
            ...BUILT_IN_GLOBALS,
            "super",
            "import"
          ]),
          IDENT_RE$1, regex.lookahead(/\(/)),
        className: "title.function",
        relevance: 0
      };

      const PROPERTY_ACCESS = {
        begin: regex.concat(/\./, regex.lookahead(
          regex.concat(IDENT_RE$1, /(?![0-9A-Za-z$_(])/)
        )),
        end: IDENT_RE$1,
        excludeBegin: true,
        keywords: "prototype",
        className: "property",
        relevance: 0
      };

      const GETTER_OR_SETTER = {
        match: [
          /get|set/,
          /\s+/,
          IDENT_RE$1,
          /(?=\()/
        ],
        className: {
          1: "keyword",
          3: "title.function"
        },
        contains: [
          { // eat to avoid empty params
            begin: /\(\)/
          },
          PARAMS
        ]
      };

      const FUNC_LEAD_IN_RE = '(\\(' +
        '[^()]*(\\(' +
        '[^()]*(\\(' +
        '[^()]*' +
        '\\)[^()]*)*' +
        '\\)[^()]*)*' +
        '\\)|' + hljs.UNDERSCORE_IDENT_RE + ')\\s*=>';

      const FUNCTION_VARIABLE = {
        match: [
          /const|var|let/, /\s+/,
          IDENT_RE$1, /\s*/,
          /=\s*/,
          /(async\s*)?/, // async is optional
          regex.lookahead(FUNC_LEAD_IN_RE)
        ],
        keywords: "async",
        className: {
          1: "keyword",
          3: "title.function"
        },
        contains: [
          PARAMS
        ]
      };

      return {
        name: 'Javascript',
        aliases: ['js', 'jsx', 'mjs', 'cjs'],
        keywords: KEYWORDS$1,
        // this will be extended by TypeScript
        exports: { PARAMS_CONTAINS, CLASS_REFERENCE },
        illegal: /#(?![$_A-z])/,
        contains: [
          hljs.SHEBANG({
            label: "shebang",
            binary: "node",
            relevance: 5
          }),
          USE_STRICT,
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE,
          HTML_TEMPLATE,
          CSS_TEMPLATE,
          GRAPHQL_TEMPLATE,
          TEMPLATE_STRING,
          COMMENT,
          // Skip numbers when they are part of a variable name
          { match: /\$\d+/ },
          NUMBER,
          CLASS_REFERENCE,
          {
            className: 'attr',
            begin: IDENT_RE$1 + regex.lookahead(':'),
            relevance: 0
          },
          FUNCTION_VARIABLE,
          { // "value" container
            begin: '(' + hljs.RE_STARTERS_RE + '|\\b(case|return|throw)\\b)\\s*',
            keywords: 'return throw case',
            relevance: 0,
            contains: [
              COMMENT,
              hljs.REGEXP_MODE,
              {
                className: 'function',
                // we have to count the parens to make sure we actually have the
                // correct bounding ( ) before the =>.  There could be any number of
                // sub-expressions inside also surrounded by parens.
                begin: FUNC_LEAD_IN_RE,
                returnBegin: true,
                end: '\\s*=>',
                contains: [
                  {
                    className: 'params',
                    variants: [
                      {
                        begin: hljs.UNDERSCORE_IDENT_RE,
                        relevance: 0
                      },
                      {
                        className: null,
                        begin: /\(\s*\)/,
                        skip: true
                      },
                      {
                        begin: /\(/,
                        end: /\)/,
                        excludeBegin: true,
                        excludeEnd: true,
                        keywords: KEYWORDS$1,
                        contains: PARAMS_CONTAINS
                      }
                    ]
                  }
                ]
              },
              { // could be a comma delimited list of params to a function call
                begin: /,/,
                relevance: 0
              },
              {
                match: /\s+/,
                relevance: 0
              },
              { // JSX
                variants: [
                  { begin: FRAGMENT.begin, end: FRAGMENT.end },
                  { match: XML_SELF_CLOSING },
                  {
                    begin: XML_TAG.begin,
                    // we carefully check the opening tag to see if it truly
                    // is a tag and not a false positive
                    'on:begin': XML_TAG.isTrulyOpeningTag,
                    end: XML_TAG.end
                  }
                ],
                subLanguage: 'xml',
                contains: [
                  {
                    begin: XML_TAG.begin,
                    end: XML_TAG.end,
                    skip: true,
                    contains: ['self']
                  }
                ]
              }
            ],
          },
          FUNCTION_DEFINITION,
          {
            // prevent this from getting swallowed up by function
            // since they appear "function like"
            beginKeywords: "while if switch catch for"
          },
          {
            // we have to count the parens to make sure we actually have the correct
            // bounding ( ).  There could be any number of sub-expressions inside
            // also surrounded by parens.
            begin: '\\b(?!function)' + hljs.UNDERSCORE_IDENT_RE +
              '\\(' + // first parens
              '[^()]*(\\(' +
                '[^()]*(\\(' +
                  '[^()]*' +
                '\\)[^()]*)*' +
              '\\)[^()]*)*' +
              '\\)\\s*\\{', // end parens
            returnBegin:true,
            label: "func.def",
            contains: [
              PARAMS,
              hljs.inherit(hljs.TITLE_MODE, { begin: IDENT_RE$1, className: "title.function" })
            ]
          },
          // catch ... so it won't trigger the property rule below
          {
            match: /\.\.\./,
            relevance: 0
          },
          PROPERTY_ACCESS,
          // hack: prevents detection of keywords in some circumstances
          // .keyword()
          // $keyword = x
          {
            match: '\\$' + IDENT_RE$1,
            relevance: 0
          },
          {
            match: [ /\bconstructor(?=\s*\()/ ],
            className: { 1: "title.function" },
            contains: [ PARAMS ]
          },
          FUNCTION_CALL,
          UPPER_CASE_CONSTANT,
          CLASS_OR_EXTENDS,
          GETTER_OR_SETTER,
          {
            match: /\$[(.]/ // relevance booster for a pattern common to JS libs: `$(something)` and `$.something`
          }
        ]
      };
    }

    /*
    Language: JSON
    Description: JSON (JavaScript Object Notation) is a lightweight data-interchange format.
    Author: Ivan Sagalaev <maniac@softwaremaniacs.org>
    Website: http://www.json.org
    Category: common, protocols, web
    */

    function json(hljs) {
      const ATTRIBUTE = {
        className: 'attr',
        begin: /"(\\.|[^\\"\r\n])*"(?=\s*:)/,
        relevance: 1.01
      };
      const PUNCTUATION = {
        match: /[{}[\],:]/,
        className: "punctuation",
        relevance: 0
      };
      const LITERALS = [
        "true",
        "false",
        "null"
      ];
      // NOTE: normally we would rely on `keywords` for this but using a mode here allows us
      // - to use the very tight `illegal: \S` rule later to flag any other character
      // - as illegal indicating that despite looking like JSON we do not truly have
      // - JSON and thus improve false-positively greatly since JSON will try and claim
      // - all sorts of JSON looking stuff
      const LITERALS_MODE = {
        scope: "literal",
        beginKeywords: LITERALS.join(" "),
      };

      return {
        name: 'JSON',
        keywords:{
          literal: LITERALS,
        },
        contains: [
          ATTRIBUTE,
          PUNCTUATION,
          hljs.QUOTE_STRING_MODE,
          LITERALS_MODE,
          hljs.C_NUMBER_MODE,
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ],
        illegal: '\\S'
      };
    }

    /*
    Language: Julia
    Description: Julia is a high-level, high-performance, dynamic programming language.
    Author: Kenta Sato <bicycle1885@gmail.com>
    Contributors: Alex Arslan <ararslan@comcast.net>, Fredrik Ekre <ekrefredrik@gmail.com>
    Website: https://julialang.org
    */

    function julia(hljs) {
      // Since there are numerous special names in Julia, it is too much trouble
      // to maintain them by hand. Hence these names (i.e. keywords, literals and
      // built-ins) are automatically generated from Julia 1.5.2 itself through
      // the following scripts for each.

      // ref: https://docs.julialang.org/en/v1/manual/variables/#Allowed-Variable-Names
      const VARIABLE_NAME_RE = '[A-Za-z_\\u00A1-\\uFFFF][A-Za-z_0-9\\u00A1-\\uFFFF]*';

      // # keyword generator, multi-word keywords handled manually below (Julia 1.5.2)
      // import REPL.REPLCompletions
      // res = String["in", "isa", "where"]
      // for kw in collect(x.keyword for x in REPLCompletions.complete_keyword(""))
      //     if !(contains(kw, " ") || kw == "struct")
      //         push!(res, kw)
      //     end
      // end
      // sort!(unique!(res))
      // foreach(x -> println("\'", x, "\',"), res)
      const KEYWORD_LIST = [
        'baremodule',
        'begin',
        'break',
        'catch',
        'ccall',
        'const',
        'continue',
        'do',
        'else',
        'elseif',
        'end',
        'export',
        'false',
        'finally',
        'for',
        'function',
        'global',
        'if',
        'import',
        'in',
        'isa',
        'let',
        'local',
        'macro',
        'module',
        'quote',
        'return',
        'true',
        'try',
        'using',
        'where',
        'while',
      ];

      // # literal generator (Julia 1.5.2)
      // import REPL.REPLCompletions
      // res = String["true", "false"]
      // for compl in filter!(x -> isa(x, REPLCompletions.ModuleCompletion) && (x.parent === Base || x.parent === Core),
      //                     REPLCompletions.completions("", 0)[1])
      //     try
      //         v = eval(Symbol(compl.mod))
      //         if !(v isa Function || v isa Type || v isa TypeVar || v isa Module || v isa Colon)
      //             push!(res, compl.mod)
      //         end
      //     catch e
      //     end
      // end
      // sort!(unique!(res))
      // foreach(x -> println("\'", x, "\',"), res)
      const LITERAL_LIST = [
        'ARGS',
        'C_NULL',
        'DEPOT_PATH',
        'ENDIAN_BOM',
        'ENV',
        'Inf',
        'Inf16',
        'Inf32',
        'Inf64',
        'InsertionSort',
        'LOAD_PATH',
        'MergeSort',
        'NaN',
        'NaN16',
        'NaN32',
        'NaN64',
        'PROGRAM_FILE',
        'QuickSort',
        'RoundDown',
        'RoundFromZero',
        'RoundNearest',
        'RoundNearestTiesAway',
        'RoundNearestTiesUp',
        'RoundToZero',
        'RoundUp',
        'VERSION|0',
        'devnull',
        'false',
        'im',
        'missing',
        'nothing',
        'pi',
        'stderr',
        'stdin',
        'stdout',
        'true',
        'undef',
        'π',
        'ℯ',
      ];

      // # built_in generator (Julia 1.5.2)
      // import REPL.REPLCompletions
      // res = String[]
      // for compl in filter!(x -> isa(x, REPLCompletions.ModuleCompletion) && (x.parent === Base || x.parent === Core),
      //                     REPLCompletions.completions("", 0)[1])
      //     try
      //         v = eval(Symbol(compl.mod))
      //         if (v isa Type || v isa TypeVar) && (compl.mod != "=>")
      //             push!(res, compl.mod)
      //         end
      //     catch e
      //     end
      // end
      // sort!(unique!(res))
      // foreach(x -> println("\'", x, "\',"), res)
      const BUILT_IN_LIST = [
        'AbstractArray',
        'AbstractChannel',
        'AbstractChar',
        'AbstractDict',
        'AbstractDisplay',
        'AbstractFloat',
        'AbstractIrrational',
        'AbstractMatrix',
        'AbstractRange',
        'AbstractSet',
        'AbstractString',
        'AbstractUnitRange',
        'AbstractVecOrMat',
        'AbstractVector',
        'Any',
        'ArgumentError',
        'Array',
        'AssertionError',
        'BigFloat',
        'BigInt',
        'BitArray',
        'BitMatrix',
        'BitSet',
        'BitVector',
        'Bool',
        'BoundsError',
        'CapturedException',
        'CartesianIndex',
        'CartesianIndices',
        'Cchar',
        'Cdouble',
        'Cfloat',
        'Channel',
        'Char',
        'Cint',
        'Cintmax_t',
        'Clong',
        'Clonglong',
        'Cmd',
        'Colon',
        'Complex',
        'ComplexF16',
        'ComplexF32',
        'ComplexF64',
        'CompositeException',
        'Condition',
        'Cptrdiff_t',
        'Cshort',
        'Csize_t',
        'Cssize_t',
        'Cstring',
        'Cuchar',
        'Cuint',
        'Cuintmax_t',
        'Culong',
        'Culonglong',
        'Cushort',
        'Cvoid',
        'Cwchar_t',
        'Cwstring',
        'DataType',
        'DenseArray',
        'DenseMatrix',
        'DenseVecOrMat',
        'DenseVector',
        'Dict',
        'DimensionMismatch',
        'Dims',
        'DivideError',
        'DomainError',
        'EOFError',
        'Enum',
        'ErrorException',
        'Exception',
        'ExponentialBackOff',
        'Expr',
        'Float16',
        'Float32',
        'Float64',
        'Function',
        'GlobalRef',
        'HTML',
        'IO',
        'IOBuffer',
        'IOContext',
        'IOStream',
        'IdDict',
        'IndexCartesian',
        'IndexLinear',
        'IndexStyle',
        'InexactError',
        'InitError',
        'Int',
        'Int128',
        'Int16',
        'Int32',
        'Int64',
        'Int8',
        'Integer',
        'InterruptException',
        'InvalidStateException',
        'Irrational',
        'KeyError',
        'LinRange',
        'LineNumberNode',
        'LinearIndices',
        'LoadError',
        'MIME',
        'Matrix',
        'Method',
        'MethodError',
        'Missing',
        'MissingException',
        'Module',
        'NTuple',
        'NamedTuple',
        'Nothing',
        'Number',
        'OrdinalRange',
        'OutOfMemoryError',
        'OverflowError',
        'Pair',
        'PartialQuickSort',
        'PermutedDimsArray',
        'Pipe',
        'ProcessFailedException',
        'Ptr',
        'QuoteNode',
        'Rational',
        'RawFD',
        'ReadOnlyMemoryError',
        'Real',
        'ReentrantLock',
        'Ref',
        'Regex',
        'RegexMatch',
        'RoundingMode',
        'SegmentationFault',
        'Set',
        'Signed',
        'Some',
        'StackOverflowError',
        'StepRange',
        'StepRangeLen',
        'StridedArray',
        'StridedMatrix',
        'StridedVecOrMat',
        'StridedVector',
        'String',
        'StringIndexError',
        'SubArray',
        'SubString',
        'SubstitutionString',
        'Symbol',
        'SystemError',
        'Task',
        'TaskFailedException',
        'Text',
        'TextDisplay',
        'Timer',
        'Tuple',
        'Type',
        'TypeError',
        'TypeVar',
        'UInt',
        'UInt128',
        'UInt16',
        'UInt32',
        'UInt64',
        'UInt8',
        'UndefInitializer',
        'UndefKeywordError',
        'UndefRefError',
        'UndefVarError',
        'Union',
        'UnionAll',
        'UnitRange',
        'Unsigned',
        'Val',
        'Vararg',
        'VecElement',
        'VecOrMat',
        'Vector',
        'VersionNumber',
        'WeakKeyDict',
        'WeakRef',
      ];

      const KEYWORDS = {
        $pattern: VARIABLE_NAME_RE,
        keyword: KEYWORD_LIST,
        literal: LITERAL_LIST,
        built_in: BUILT_IN_LIST,
      };

      // placeholder for recursive self-reference
      const DEFAULT = {
        keywords: KEYWORDS,
        illegal: /<\//
      };

      // ref: https://docs.julialang.org/en/v1/manual/integers-and-floating-point-numbers/
      const NUMBER = {
        className: 'number',
        // supported numeric literals:
        //  * binary literal (e.g. 0x10)
        //  * octal literal (e.g. 0o76543210)
        //  * hexadecimal literal (e.g. 0xfedcba876543210)
        //  * hexadecimal floating point literal (e.g. 0x1p0, 0x1.2p2)
        //  * decimal literal (e.g. 9876543210, 100_000_000)
        //  * floating pointe literal (e.g. 1.2, 1.2f, .2, 1., 1.2e10, 1.2e-10)
        begin: /(\b0x[\d_]*(\.[\d_]*)?|0x\.\d[\d_]*)p[-+]?\d+|\b0[box][a-fA-F0-9][a-fA-F0-9_]*|(\b\d[\d_]*(\.[\d_]*)?|\.\d[\d_]*)([eEfF][-+]?\d+)?/,
        relevance: 0
      };

      const CHAR = {
        className: 'string',
        begin: /'(.|\\[xXuU][a-zA-Z0-9]+)'/
      };

      const INTERPOLATION = {
        className: 'subst',
        begin: /\$\(/,
        end: /\)/,
        keywords: KEYWORDS
      };

      const INTERPOLATED_VARIABLE = {
        className: 'variable',
        begin: '\\$' + VARIABLE_NAME_RE
      };

      // TODO: neatly escape normal code in string literal
      const STRING = {
        className: 'string',
        contains: [
          hljs.BACKSLASH_ESCAPE,
          INTERPOLATION,
          INTERPOLATED_VARIABLE
        ],
        variants: [
          {
            begin: /\w*"""/,
            end: /"""\w*/,
            relevance: 10
          },
          {
            begin: /\w*"/,
            end: /"\w*/
          }
        ]
      };

      const COMMAND = {
        className: 'string',
        contains: [
          hljs.BACKSLASH_ESCAPE,
          INTERPOLATION,
          INTERPOLATED_VARIABLE
        ],
        begin: '`',
        end: '`'
      };

      const MACROCALL = {
        className: 'meta',
        begin: '@' + VARIABLE_NAME_RE
      };

      const COMMENT = {
        className: 'comment',
        variants: [
          {
            begin: '#=',
            end: '=#',
            relevance: 10
          },
          {
            begin: '#',
            end: '$'
          }
        ]
      };

      DEFAULT.name = 'Julia';
      DEFAULT.contains = [
        NUMBER,
        CHAR,
        STRING,
        COMMAND,
        MACROCALL,
        COMMENT,
        hljs.HASH_COMMENT_MODE,
        {
          className: 'keyword',
          begin:
            '\\b(((abstract|primitive)\\s+)type|(mutable\\s+)?struct)\\b'
        },
        { begin: /<:/ } // relevance booster
      ];
      INTERPOLATION.contains = DEFAULT.contains;

      return DEFAULT;
    }

    /*
     Language: Kotlin
     Description: Kotlin is an OSS statically typed programming language that targets the JVM, Android, JavaScript and Native.
     Author: Sergey Mashkov <cy6erGn0m@gmail.com>
     Website: https://kotlinlang.org
     Category: common
     */

    function kotlin(hljs) {
      const KEYWORDS = {
        keyword:
          'abstract as val var vararg get set class object open private protected public noinline '
          + 'crossinline dynamic final enum if else do while for when throw try catch finally '
          + 'import package is in fun override companion reified inline lateinit init '
          + 'interface annotation data sealed internal infix operator out by constructor super '
          + 'tailrec where const inner suspend typealias external expect actual',
        built_in:
          'Byte Short Char Int Long Boolean Float Double Void Unit Nothing',
        literal:
          'true false null'
      };
      const KEYWORDS_WITH_LABEL = {
        className: 'keyword',
        begin: /\b(break|continue|return|this)\b/,
        starts: { contains: [
          {
            className: 'symbol',
            begin: /@\w+/
          }
        ] }
      };
      const LABEL = {
        className: 'symbol',
        begin: hljs.UNDERSCORE_IDENT_RE + '@'
      };

      // for string templates
      const SUBST = {
        className: 'subst',
        begin: /\$\{/,
        end: /\}/,
        contains: [ hljs.C_NUMBER_MODE ]
      };
      const VARIABLE = {
        className: 'variable',
        begin: '\\$' + hljs.UNDERSCORE_IDENT_RE
      };
      const STRING = {
        className: 'string',
        variants: [
          {
            begin: '"""',
            end: '"""(?=[^"])',
            contains: [
              VARIABLE,
              SUBST
            ]
          },
          // Can't use built-in modes easily, as we want to use STRING in the meta
          // context as 'meta-string' and there's no syntax to remove explicitly set
          // classNames in built-in modes.
          {
            begin: '\'',
            end: '\'',
            illegal: /\n/,
            contains: [ hljs.BACKSLASH_ESCAPE ]
          },
          {
            begin: '"',
            end: '"',
            illegal: /\n/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              VARIABLE,
              SUBST
            ]
          }
        ]
      };
      SUBST.contains.push(STRING);

      const ANNOTATION_USE_SITE = {
        className: 'meta',
        begin: '@(?:file|property|field|get|set|receiver|param|setparam|delegate)\\s*:(?:\\s*' + hljs.UNDERSCORE_IDENT_RE + ')?'
      };
      const ANNOTATION = {
        className: 'meta',
        begin: '@' + hljs.UNDERSCORE_IDENT_RE,
        contains: [
          {
            begin: /\(/,
            end: /\)/,
            contains: [
              hljs.inherit(STRING, { className: 'string' }),
              "self"
            ]
          }
        ]
      };

      // https://kotlinlang.org/docs/reference/whatsnew11.html#underscores-in-numeric-literals
      // According to the doc above, the number mode of kotlin is the same as java 8,
      // so the code below is copied from java.js
      const KOTLIN_NUMBER_MODE = NUMERIC;
      const KOTLIN_NESTED_COMMENT = hljs.COMMENT(
        '/\\*', '\\*/',
        { contains: [ hljs.C_BLOCK_COMMENT_MODE ] }
      );
      const KOTLIN_PAREN_TYPE = { variants: [
        {
          className: 'type',
          begin: hljs.UNDERSCORE_IDENT_RE
        },
        {
          begin: /\(/,
          end: /\)/,
          contains: [] // defined later
        }
      ] };
      const KOTLIN_PAREN_TYPE2 = KOTLIN_PAREN_TYPE;
      KOTLIN_PAREN_TYPE2.variants[1].contains = [ KOTLIN_PAREN_TYPE ];
      KOTLIN_PAREN_TYPE.variants[1].contains = [ KOTLIN_PAREN_TYPE2 ];

      return {
        name: 'Kotlin',
        aliases: [
          'kt',
          'kts'
        ],
        keywords: KEYWORDS,
        contains: [
          hljs.COMMENT(
            '/\\*\\*',
            '\\*/',
            {
              relevance: 0,
              contains: [
                {
                  className: 'doctag',
                  begin: '@[A-Za-z]+'
                }
              ]
            }
          ),
          hljs.C_LINE_COMMENT_MODE,
          KOTLIN_NESTED_COMMENT,
          KEYWORDS_WITH_LABEL,
          LABEL,
          ANNOTATION_USE_SITE,
          ANNOTATION,
          {
            className: 'function',
            beginKeywords: 'fun',
            end: '[(]|$',
            returnBegin: true,
            excludeEnd: true,
            keywords: KEYWORDS,
            relevance: 5,
            contains: [
              {
                begin: hljs.UNDERSCORE_IDENT_RE + '\\s*\\(',
                returnBegin: true,
                relevance: 0,
                contains: [ hljs.UNDERSCORE_TITLE_MODE ]
              },
              {
                className: 'type',
                begin: /</,
                end: />/,
                keywords: 'reified',
                relevance: 0
              },
              {
                className: 'params',
                begin: /\(/,
                end: /\)/,
                endsParent: true,
                keywords: KEYWORDS,
                relevance: 0,
                contains: [
                  {
                    begin: /:/,
                    end: /[=,\/]/,
                    endsWithParent: true,
                    contains: [
                      KOTLIN_PAREN_TYPE,
                      hljs.C_LINE_COMMENT_MODE,
                      KOTLIN_NESTED_COMMENT
                    ],
                    relevance: 0
                  },
                  hljs.C_LINE_COMMENT_MODE,
                  KOTLIN_NESTED_COMMENT,
                  ANNOTATION_USE_SITE,
                  ANNOTATION,
                  STRING,
                  hljs.C_NUMBER_MODE
                ]
              },
              KOTLIN_NESTED_COMMENT
            ]
          },
          {
            begin: [
              /class|interface|trait/,
              /\s+/,
              hljs.UNDERSCORE_IDENT_RE
            ],
            beginScope: {
              3: "title.class"
            },
            keywords: 'class interface trait',
            end: /[:\{(]|$/,
            excludeEnd: true,
            illegal: 'extends implements',
            contains: [
              { beginKeywords: 'public protected internal private constructor' },
              hljs.UNDERSCORE_TITLE_MODE,
              {
                className: 'type',
                begin: /</,
                end: />/,
                excludeBegin: true,
                excludeEnd: true,
                relevance: 0
              },
              {
                className: 'type',
                begin: /[,:]\s*/,
                end: /[<\(,){\s]|$/,
                excludeBegin: true,
                returnEnd: true
              },
              ANNOTATION_USE_SITE,
              ANNOTATION
            ]
          },
          STRING,
          {
            className: 'meta',
            begin: "^#!/usr/bin/env",
            end: '$',
            illegal: '\n'
          },
          KOTLIN_NUMBER_MODE
        ]
      };
    }

    /*
    Language: Lisp
    Description: Generic lisp syntax
    Author: Vasily Polovnyov <vast@whiteants.net>
    Category: lisp
    */

    function lisp(hljs) {
      const LISP_IDENT_RE = '[a-zA-Z_\\-+\\*\\/<=>&#][a-zA-Z0-9_\\-+*\\/<=>&#!]*';
      const MEC_RE = '\\|[^]*?\\|';
      const LISP_SIMPLE_NUMBER_RE = '(-|\\+)?\\d+(\\.\\d+|\\/\\d+)?((d|e|f|l|s|D|E|F|L|S)(\\+|-)?\\d+)?';
      const LITERAL = {
        className: 'literal',
        begin: '\\b(t{1}|nil)\\b'
      };
      const NUMBER = {
        className: 'number',
        variants: [
          {
            begin: LISP_SIMPLE_NUMBER_RE,
            relevance: 0
          },
          { begin: '#(b|B)[0-1]+(/[0-1]+)?' },
          { begin: '#(o|O)[0-7]+(/[0-7]+)?' },
          { begin: '#(x|X)[0-9a-fA-F]+(/[0-9a-fA-F]+)?' },
          {
            begin: '#(c|C)\\(' + LISP_SIMPLE_NUMBER_RE + ' +' + LISP_SIMPLE_NUMBER_RE,
            end: '\\)'
          }
        ]
      };
      const STRING = hljs.inherit(hljs.QUOTE_STRING_MODE, { illegal: null });
      const COMMENT = hljs.COMMENT(
        ';', '$',
        { relevance: 0 }
      );
      const VARIABLE = {
        begin: '\\*',
        end: '\\*'
      };
      const KEYWORD = {
        className: 'symbol',
        begin: '[:&]' + LISP_IDENT_RE
      };
      const IDENT = {
        begin: LISP_IDENT_RE,
        relevance: 0
      };
      const MEC = { begin: MEC_RE };
      const QUOTED_LIST = {
        begin: '\\(',
        end: '\\)',
        contains: [
          'self',
          LITERAL,
          STRING,
          NUMBER,
          IDENT
        ]
      };
      const QUOTED = {
        contains: [
          NUMBER,
          STRING,
          VARIABLE,
          KEYWORD,
          QUOTED_LIST,
          IDENT
        ],
        variants: [
          {
            begin: '[\'`]\\(',
            end: '\\)'
          },
          {
            begin: '\\(quote ',
            end: '\\)',
            keywords: { name: 'quote' }
          },
          { begin: '\'' + MEC_RE }
        ]
      };
      const QUOTED_ATOM = { variants: [
        { begin: '\'' + LISP_IDENT_RE },
        { begin: '#\'' + LISP_IDENT_RE + '(::' + LISP_IDENT_RE + ')*' }
      ] };
      const LIST = {
        begin: '\\(\\s*',
        end: '\\)'
      };
      const BODY = {
        endsWithParent: true,
        relevance: 0
      };
      LIST.contains = [
        {
          className: 'name',
          variants: [
            {
              begin: LISP_IDENT_RE,
              relevance: 0,
            },
            { begin: MEC_RE }
          ]
        },
        BODY
      ];
      BODY.contains = [
        QUOTED,
        QUOTED_ATOM,
        LIST,
        LITERAL,
        NUMBER,
        STRING,
        COMMENT,
        VARIABLE,
        KEYWORD,
        MEC,
        IDENT
      ];

      return {
        name: 'Lisp',
        illegal: /\S/,
        contains: [
          NUMBER,
          hljs.SHEBANG(),
          LITERAL,
          STRING,
          COMMENT,
          QUOTED,
          QUOTED_ATOM,
          LIST,
          IDENT
        ]
      };
    }

    /*
    Language: LLVM IR
    Author: Michael Rodler <contact@f0rki.at>
    Description: language used as intermediate representation in the LLVM compiler framework
    Website: https://llvm.org/docs/LangRef.html
    Category: assembler
    Audit: 2020
    */

    /** @type LanguageFn */
    function llvm(hljs) {
      const regex = hljs.regex;
      const IDENT_RE = /([-a-zA-Z$._][\w$.-]*)/;
      const TYPE = {
        className: 'type',
        begin: /\bi\d+(?=\s|\b)/
      };
      const OPERATOR = {
        className: 'operator',
        relevance: 0,
        begin: /=/
      };
      const PUNCTUATION = {
        className: 'punctuation',
        relevance: 0,
        begin: /,/
      };
      const NUMBER = {
        className: 'number',
        variants: [
          { begin: /[su]?0[xX][KMLHR]?[a-fA-F0-9]+/ },
          { begin: /[-+]?\d+(?:[.]\d+)?(?:[eE][-+]?\d+(?:[.]\d+)?)?/ }
        ],
        relevance: 0
      };
      const LABEL = {
        className: 'symbol',
        variants: [ { begin: /^\s*[a-z]+:/ }, // labels
        ],
        relevance: 0
      };
      const VARIABLE = {
        className: 'variable',
        variants: [
          { begin: regex.concat(/%/, IDENT_RE) },
          { begin: /%\d+/ },
          { begin: /#\d+/ },
        ]
      };
      const FUNCTION = {
        className: 'title',
        variants: [
          { begin: regex.concat(/@/, IDENT_RE) },
          { begin: /@\d+/ },
          { begin: regex.concat(/!/, IDENT_RE) },
          { begin: regex.concat(/!\d+/, IDENT_RE) },
          // https://llvm.org/docs/LangRef.html#namedmetadatastructure
          // obviously a single digit can also be used in this fashion
          { begin: /!\d+/ }
        ]
      };

      return {
        name: 'LLVM IR',
        // TODO: split into different categories of keywords
        keywords:
          'begin end true false declare define global '
          + 'constant private linker_private internal '
          + 'available_externally linkonce linkonce_odr weak '
          + 'weak_odr appending dllimport dllexport common '
          + 'default hidden protected extern_weak external '
          + 'thread_local zeroinitializer undef null to tail '
          + 'target triple datalayout volatile nuw nsw nnan '
          + 'ninf nsz arcp fast exact inbounds align '
          + 'addrspace section alias module asm sideeffect '
          + 'gc dbg linker_private_weak attributes blockaddress '
          + 'initialexec localdynamic localexec prefix unnamed_addr '
          + 'ccc fastcc coldcc x86_stdcallcc x86_fastcallcc '
          + 'arm_apcscc arm_aapcscc arm_aapcs_vfpcc ptx_device '
          + 'ptx_kernel intel_ocl_bicc msp430_intrcc spir_func '
          + 'spir_kernel x86_64_sysvcc x86_64_win64cc x86_thiscallcc '
          + 'cc c signext zeroext inreg sret nounwind '
          + 'noreturn noalias nocapture byval nest readnone '
          + 'readonly inlinehint noinline alwaysinline optsize ssp '
          + 'sspreq noredzone noimplicitfloat naked builtin cold '
          + 'nobuiltin noduplicate nonlazybind optnone returns_twice '
          + 'sanitize_address sanitize_memory sanitize_thread sspstrong '
          + 'uwtable returned type opaque eq ne slt sgt '
          + 'sle sge ult ugt ule uge oeq one olt ogt '
          + 'ole oge ord uno ueq une x acq_rel acquire '
          + 'alignstack atomic catch cleanup filter inteldialect '
          + 'max min monotonic nand personality release seq_cst '
          + 'singlethread umax umin unordered xchg add fadd '
          + 'sub fsub mul fmul udiv sdiv fdiv urem srem '
          + 'frem shl lshr ashr and or xor icmp fcmp '
          + 'phi call trunc zext sext fptrunc fpext uitofp '
          + 'sitofp fptoui fptosi inttoptr ptrtoint bitcast '
          + 'addrspacecast select va_arg ret br switch invoke '
          + 'unwind unreachable indirectbr landingpad resume '
          + 'malloc alloca free load store getelementptr '
          + 'extractelement insertelement shufflevector getresult '
          + 'extractvalue insertvalue atomicrmw cmpxchg fence '
          + 'argmemonly double',
        contains: [
          TYPE,
          // this matches "empty comments"...
          // ...because it's far more likely this is a statement terminator in
          // another language than an actual comment
          hljs.COMMENT(/;\s*$/, null, { relevance: 0 }),
          hljs.COMMENT(/;/, /$/),
          {
            className: 'string',
            begin: /"/,
            end: /"/,
            contains: [
              {
                className: 'char.escape',
                match: /\\\d\d/
              }
            ]
          },
          FUNCTION,
          PUNCTUATION,
          OPERATOR,
          VARIABLE,
          LABEL,
          NUMBER
        ]
      };
    }

    /*
    Language: Lua
    Description: Lua is a powerful, efficient, lightweight, embeddable scripting language.
    Author: Andrew Fedorov <dmmdrs@mail.ru>
    Category: common, scripting
    Website: https://www.lua.org
    */

    function lua(hljs) {
      const OPENING_LONG_BRACKET = '\\[=*\\[';
      const CLOSING_LONG_BRACKET = '\\]=*\\]';
      const LONG_BRACKETS = {
        begin: OPENING_LONG_BRACKET,
        end: CLOSING_LONG_BRACKET,
        contains: [ 'self' ]
      };
      const COMMENTS = [
        hljs.COMMENT('--(?!' + OPENING_LONG_BRACKET + ')', '$'),
        hljs.COMMENT(
          '--' + OPENING_LONG_BRACKET,
          CLOSING_LONG_BRACKET,
          {
            contains: [ LONG_BRACKETS ],
            relevance: 10
          }
        )
      ];
      return {
        name: 'Lua',
        keywords: {
          $pattern: hljs.UNDERSCORE_IDENT_RE,
          literal: "true false nil",
          keyword: "and break do else elseif end for goto if in local not or repeat return then until while",
          built_in:
            // Metatags and globals:
            '_G _ENV _VERSION __index __newindex __mode __call __metatable __tostring __len '
            + '__gc __add __sub __mul __div __mod __pow __concat __unm __eq __lt __le assert '
            // Standard methods and properties:
            + 'collectgarbage dofile error getfenv getmetatable ipairs load loadfile loadstring '
            + 'module next pairs pcall print rawequal rawget rawset require select setfenv '
            + 'setmetatable tonumber tostring type unpack xpcall arg self '
            // Library methods and properties (one line per library):
            + 'coroutine resume yield status wrap create running debug getupvalue '
            + 'debug sethook getmetatable gethook setmetatable setlocal traceback setfenv getinfo setupvalue getlocal getregistry getfenv '
            + 'io lines write close flush open output type read stderr stdin input stdout popen tmpfile '
            + 'math log max acos huge ldexp pi cos tanh pow deg tan cosh sinh random randomseed frexp ceil floor rad abs sqrt modf asin min mod fmod log10 atan2 exp sin atan '
            + 'os exit setlocale date getenv difftime remove time clock tmpname rename execute package preload loadlib loaded loaders cpath config path seeall '
            + 'string sub upper len gfind rep find match char dump gmatch reverse byte format gsub lower '
            + 'table setn insert getn foreachi maxn foreach concat sort remove'
        },
        contains: COMMENTS.concat([
          {
            className: 'function',
            beginKeywords: 'function',
            end: '\\)',
            contains: [
              hljs.inherit(hljs.TITLE_MODE, { begin: '([_a-zA-Z]\\w*\\.)*([_a-zA-Z]\\w*:)?[_a-zA-Z]\\w*' }),
              {
                className: 'params',
                begin: '\\(',
                endsWithParent: true,
                contains: COMMENTS
              }
            ].concat(COMMENTS)
          },
          hljs.C_NUMBER_MODE,
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE,
          {
            className: 'string',
            begin: OPENING_LONG_BRACKET,
            end: CLOSING_LONG_BRACKET,
            contains: [ LONG_BRACKETS ],
            relevance: 5
          }
        ])
      };
    }

    /*
    Language: Makefile
    Author: Ivan Sagalaev <maniac@softwaremaniacs.org>
    Contributors: Joël Porquet <joel@porquet.org>
    Website: https://www.gnu.org/software/make/manual/html_node/Introduction.html
    Category: common
    */

    function makefile(hljs) {
      /* Variables: simple (eg $(var)) and special (eg $@) */
      const VARIABLE = {
        className: 'variable',
        variants: [
          {
            begin: '\\$\\(' + hljs.UNDERSCORE_IDENT_RE + '\\)',
            contains: [ hljs.BACKSLASH_ESCAPE ]
          },
          { begin: /\$[@%<?\^\+\*]/ }
        ]
      };
      /* Quoted string with variables inside */
      const QUOTE_STRING = {
        className: 'string',
        begin: /"/,
        end: /"/,
        contains: [
          hljs.BACKSLASH_ESCAPE,
          VARIABLE
        ]
      };
      /* Function: $(func arg,...) */
      const FUNC = {
        className: 'variable',
        begin: /\$\([\w-]+\s/,
        end: /\)/,
        keywords: { built_in:
            'subst patsubst strip findstring filter filter-out sort '
            + 'word wordlist firstword lastword dir notdir suffix basename '
            + 'addsuffix addprefix join wildcard realpath abspath error warning '
            + 'shell origin flavor foreach if or and call eval file value' },
        contains: [ VARIABLE ]
      };
      /* Variable assignment */
      const ASSIGNMENT = { begin: '^' + hljs.UNDERSCORE_IDENT_RE + '\\s*(?=[:+?]?=)' };
      /* Meta targets (.PHONY) */
      const META = {
        className: 'meta',
        begin: /^\.PHONY:/,
        end: /$/,
        keywords: {
          $pattern: /[\.\w]+/,
          keyword: '.PHONY'
        }
      };
      /* Targets */
      const TARGET = {
        className: 'section',
        begin: /^[^\s]+:/,
        end: /$/,
        contains: [ VARIABLE ]
      };
      return {
        name: 'Makefile',
        aliases: [
          'mk',
          'mak',
          'make',
        ],
        keywords: {
          $pattern: /[\w-]+/,
          keyword: 'define endef undefine ifdef ifndef ifeq ifneq else endif '
          + 'include -include sinclude override export unexport private vpath'
        },
        contains: [
          hljs.HASH_COMMENT_MODE,
          VARIABLE,
          QUOTE_STRING,
          FUNC,
          ASSIGNMENT,
          META,
          TARGET
        ]
      };
    }

    const SYSTEM_SYMBOLS = [
      "AASTriangle",
      "AbelianGroup",
      "Abort",
      "AbortKernels",
      "AbortProtect",
      "AbortScheduledTask",
      "Above",
      "Abs",
      "AbsArg",
      "AbsArgPlot",
      "Absolute",
      "AbsoluteCorrelation",
      "AbsoluteCorrelationFunction",
      "AbsoluteCurrentValue",
      "AbsoluteDashing",
      "AbsoluteFileName",
      "AbsoluteOptions",
      "AbsolutePointSize",
      "AbsoluteThickness",
      "AbsoluteTime",
      "AbsoluteTiming",
      "AcceptanceThreshold",
      "AccountingForm",
      "Accumulate",
      "Accuracy",
      "AccuracyGoal",
      "ActionDelay",
      "ActionMenu",
      "ActionMenuBox",
      "ActionMenuBoxOptions",
      "Activate",
      "Active",
      "ActiveClassification",
      "ActiveClassificationObject",
      "ActiveItem",
      "ActivePrediction",
      "ActivePredictionObject",
      "ActiveStyle",
      "AcyclicGraphQ",
      "AddOnHelpPath",
      "AddSides",
      "AddTo",
      "AddToSearchIndex",
      "AddUsers",
      "AdjacencyGraph",
      "AdjacencyList",
      "AdjacencyMatrix",
      "AdjacentMeshCells",
      "AdjustmentBox",
      "AdjustmentBoxOptions",
      "AdjustTimeSeriesForecast",
      "AdministrativeDivisionData",
      "AffineHalfSpace",
      "AffineSpace",
      "AffineStateSpaceModel",
      "AffineTransform",
      "After",
      "AggregatedEntityClass",
      "AggregationLayer",
      "AircraftData",
      "AirportData",
      "AirPressureData",
      "AirTemperatureData",
      "AiryAi",
      "AiryAiPrime",
      "AiryAiZero",
      "AiryBi",
      "AiryBiPrime",
      "AiryBiZero",
      "AlgebraicIntegerQ",
      "AlgebraicNumber",
      "AlgebraicNumberDenominator",
      "AlgebraicNumberNorm",
      "AlgebraicNumberPolynomial",
      "AlgebraicNumberTrace",
      "AlgebraicRules",
      "AlgebraicRulesData",
      "Algebraics",
      "AlgebraicUnitQ",
      "Alignment",
      "AlignmentMarker",
      "AlignmentPoint",
      "All",
      "AllowAdultContent",
      "AllowedCloudExtraParameters",
      "AllowedCloudParameterExtensions",
      "AllowedDimensions",
      "AllowedFrequencyRange",
      "AllowedHeads",
      "AllowGroupClose",
      "AllowIncomplete",
      "AllowInlineCells",
      "AllowKernelInitialization",
      "AllowLooseGrammar",
      "AllowReverseGroupClose",
      "AllowScriptLevelChange",
      "AllowVersionUpdate",
      "AllTrue",
      "Alphabet",
      "AlphabeticOrder",
      "AlphabeticSort",
      "AlphaChannel",
      "AlternateImage",
      "AlternatingFactorial",
      "AlternatingGroup",
      "AlternativeHypothesis",
      "Alternatives",
      "AltitudeMethod",
      "AmbientLight",
      "AmbiguityFunction",
      "AmbiguityList",
      "Analytic",
      "AnatomyData",
      "AnatomyForm",
      "AnatomyPlot3D",
      "AnatomySkinStyle",
      "AnatomyStyling",
      "AnchoredSearch",
      "And",
      "AndersonDarlingTest",
      "AngerJ",
      "AngleBisector",
      "AngleBracket",
      "AnglePath",
      "AnglePath3D",
      "AngleVector",
      "AngularGauge",
      "Animate",
      "AnimationCycleOffset",
      "AnimationCycleRepetitions",
      "AnimationDirection",
      "AnimationDisplayTime",
      "AnimationRate",
      "AnimationRepetitions",
      "AnimationRunning",
      "AnimationRunTime",
      "AnimationTimeIndex",
      "Animator",
      "AnimatorBox",
      "AnimatorBoxOptions",
      "AnimatorElements",
      "Annotate",
      "Annotation",
      "AnnotationDelete",
      "AnnotationKeys",
      "AnnotationRules",
      "AnnotationValue",
      "Annuity",
      "AnnuityDue",
      "Annulus",
      "AnomalyDetection",
      "AnomalyDetector",
      "AnomalyDetectorFunction",
      "Anonymous",
      "Antialiasing",
      "AntihermitianMatrixQ",
      "Antisymmetric",
      "AntisymmetricMatrixQ",
      "Antonyms",
      "AnyOrder",
      "AnySubset",
      "AnyTrue",
      "Apart",
      "ApartSquareFree",
      "APIFunction",
      "Appearance",
      "AppearanceElements",
      "AppearanceRules",
      "AppellF1",
      "Append",
      "AppendCheck",
      "AppendLayer",
      "AppendTo",
      "Apply",
      "ApplySides",
      "ArcCos",
      "ArcCosh",
      "ArcCot",
      "ArcCoth",
      "ArcCsc",
      "ArcCsch",
      "ArcCurvature",
      "ARCHProcess",
      "ArcLength",
      "ArcSec",
      "ArcSech",
      "ArcSin",
      "ArcSinDistribution",
      "ArcSinh",
      "ArcTan",
      "ArcTanh",
      "Area",
      "Arg",
      "ArgMax",
      "ArgMin",
      "ArgumentCountQ",
      "ARIMAProcess",
      "ArithmeticGeometricMean",
      "ARMAProcess",
      "Around",
      "AroundReplace",
      "ARProcess",
      "Array",
      "ArrayComponents",
      "ArrayDepth",
      "ArrayFilter",
      "ArrayFlatten",
      "ArrayMesh",
      "ArrayPad",
      "ArrayPlot",
      "ArrayQ",
      "ArrayResample",
      "ArrayReshape",
      "ArrayRules",
      "Arrays",
      "Arrow",
      "Arrow3DBox",
      "ArrowBox",
      "Arrowheads",
      "ASATriangle",
      "Ask",
      "AskAppend",
      "AskConfirm",
      "AskDisplay",
      "AskedQ",
      "AskedValue",
      "AskFunction",
      "AskState",
      "AskTemplateDisplay",
      "AspectRatio",
      "AspectRatioFixed",
      "Assert",
      "AssociateTo",
      "Association",
      "AssociationFormat",
      "AssociationMap",
      "AssociationQ",
      "AssociationThread",
      "AssumeDeterministic",
      "Assuming",
      "Assumptions",
      "AstronomicalData",
      "Asymptotic",
      "AsymptoticDSolveValue",
      "AsymptoticEqual",
      "AsymptoticEquivalent",
      "AsymptoticGreater",
      "AsymptoticGreaterEqual",
      "AsymptoticIntegrate",
      "AsymptoticLess",
      "AsymptoticLessEqual",
      "AsymptoticOutputTracker",
      "AsymptoticProduct",
      "AsymptoticRSolveValue",
      "AsymptoticSolve",
      "AsymptoticSum",
      "Asynchronous",
      "AsynchronousTaskObject",
      "AsynchronousTasks",
      "Atom",
      "AtomCoordinates",
      "AtomCount",
      "AtomDiagramCoordinates",
      "AtomList",
      "AtomQ",
      "AttentionLayer",
      "Attributes",
      "Audio",
      "AudioAmplify",
      "AudioAnnotate",
      "AudioAnnotationLookup",
      "AudioBlockMap",
      "AudioCapture",
      "AudioChannelAssignment",
      "AudioChannelCombine",
      "AudioChannelMix",
      "AudioChannels",
      "AudioChannelSeparate",
      "AudioData",
      "AudioDelay",
      "AudioDelete",
      "AudioDevice",
      "AudioDistance",
      "AudioEncoding",
      "AudioFade",
      "AudioFrequencyShift",
      "AudioGenerator",
      "AudioIdentify",
      "AudioInputDevice",
      "AudioInsert",
      "AudioInstanceQ",
      "AudioIntervals",
      "AudioJoin",
      "AudioLabel",
      "AudioLength",
      "AudioLocalMeasurements",
      "AudioLooping",
      "AudioLoudness",
      "AudioMeasurements",
      "AudioNormalize",
      "AudioOutputDevice",
      "AudioOverlay",
      "AudioPad",
      "AudioPan",
      "AudioPartition",
      "AudioPause",
      "AudioPitchShift",
      "AudioPlay",
      "AudioPlot",
      "AudioQ",
      "AudioRecord",
      "AudioReplace",
      "AudioResample",
      "AudioReverb",
      "AudioReverse",
      "AudioSampleRate",
      "AudioSpectralMap",
      "AudioSpectralTransformation",
      "AudioSplit",
      "AudioStop",
      "AudioStream",
      "AudioStreams",
      "AudioTimeStretch",
      "AudioTracks",
      "AudioTrim",
      "AudioType",
      "AugmentedPolyhedron",
      "AugmentedSymmetricPolynomial",
      "Authenticate",
      "Authentication",
      "AuthenticationDialog",
      "AutoAction",
      "Autocomplete",
      "AutocompletionFunction",
      "AutoCopy",
      "AutocorrelationTest",
      "AutoDelete",
      "AutoEvaluateEvents",
      "AutoGeneratedPackage",
      "AutoIndent",
      "AutoIndentSpacings",
      "AutoItalicWords",
      "AutoloadPath",
      "AutoMatch",
      "Automatic",
      "AutomaticImageSize",
      "AutoMultiplicationSymbol",
      "AutoNumberFormatting",
      "AutoOpenNotebooks",
      "AutoOpenPalettes",
      "AutoQuoteCharacters",
      "AutoRefreshed",
      "AutoRemove",
      "AutorunSequencing",
      "AutoScaling",
      "AutoScroll",
      "AutoSpacing",
      "AutoStyleOptions",
      "AutoStyleWords",
      "AutoSubmitting",
      "Axes",
      "AxesEdge",
      "AxesLabel",
      "AxesOrigin",
      "AxesStyle",
      "AxiomaticTheory",
      "Axis",
      "BabyMonsterGroupB",
      "Back",
      "Background",
      "BackgroundAppearance",
      "BackgroundTasksSettings",
      "Backslash",
      "Backsubstitution",
      "Backward",
      "Ball",
      "Band",
      "BandpassFilter",
      "BandstopFilter",
      "BarabasiAlbertGraphDistribution",
      "BarChart",
      "BarChart3D",
      "BarcodeImage",
      "BarcodeRecognize",
      "BaringhausHenzeTest",
      "BarLegend",
      "BarlowProschanImportance",
      "BarnesG",
      "BarOrigin",
      "BarSpacing",
      "BartlettHannWindow",
      "BartlettWindow",
      "BaseDecode",
      "BaseEncode",
      "BaseForm",
      "Baseline",
      "BaselinePosition",
      "BaseStyle",
      "BasicRecurrentLayer",
      "BatchNormalizationLayer",
      "BatchSize",
      "BatesDistribution",
      "BattleLemarieWavelet",
      "BayesianMaximization",
      "BayesianMaximizationObject",
      "BayesianMinimization",
      "BayesianMinimizationObject",
      "Because",
      "BeckmannDistribution",
      "Beep",
      "Before",
      "Begin",
      "BeginDialogPacket",
      "BeginFrontEndInteractionPacket",
      "BeginPackage",
      "BellB",
      "BellY",
      "Below",
      "BenfordDistribution",
      "BeniniDistribution",
      "BenktanderGibratDistribution",
      "BenktanderWeibullDistribution",
      "BernoulliB",
      "BernoulliDistribution",
      "BernoulliGraphDistribution",
      "BernoulliProcess",
      "BernsteinBasis",
      "BesselFilterModel",
      "BesselI",
      "BesselJ",
      "BesselJZero",
      "BesselK",
      "BesselY",
      "BesselYZero",
      "Beta",
      "BetaBinomialDistribution",
      "BetaDistribution",
      "BetaNegativeBinomialDistribution",
      "BetaPrimeDistribution",
      "BetaRegularized",
      "Between",
      "BetweennessCentrality",
      "BeveledPolyhedron",
      "BezierCurve",
      "BezierCurve3DBox",
      "BezierCurve3DBoxOptions",
      "BezierCurveBox",
      "BezierCurveBoxOptions",
      "BezierFunction",
      "BilateralFilter",
      "Binarize",
      "BinaryDeserialize",
      "BinaryDistance",
      "BinaryFormat",
      "BinaryImageQ",
      "BinaryRead",
      "BinaryReadList",
      "BinarySerialize",
      "BinaryWrite",
      "BinCounts",
      "BinLists",
      "Binomial",
      "BinomialDistribution",
      "BinomialProcess",
      "BinormalDistribution",
      "BiorthogonalSplineWavelet",
      "BipartiteGraphQ",
      "BiquadraticFilterModel",
      "BirnbaumImportance",
      "BirnbaumSaundersDistribution",
      "BitAnd",
      "BitClear",
      "BitGet",
      "BitLength",
      "BitNot",
      "BitOr",
      "BitSet",
      "BitShiftLeft",
      "BitShiftRight",
      "BitXor",
      "BiweightLocation",
      "BiweightMidvariance",
      "Black",
      "BlackmanHarrisWindow",
      "BlackmanNuttallWindow",
      "BlackmanWindow",
      "Blank",
      "BlankForm",
      "BlankNullSequence",
      "BlankSequence",
      "Blend",
      "Block",
      "BlockchainAddressData",
      "BlockchainBase",
      "BlockchainBlockData",
      "BlockchainContractValue",
      "BlockchainData",
      "BlockchainGet",
      "BlockchainKeyEncode",
      "BlockchainPut",
      "BlockchainTokenData",
      "BlockchainTransaction",
      "BlockchainTransactionData",
      "BlockchainTransactionSign",
      "BlockchainTransactionSubmit",
      "BlockMap",
      "BlockRandom",
      "BlomqvistBeta",
      "BlomqvistBetaTest",
      "Blue",
      "Blur",
      "BodePlot",
      "BohmanWindow",
      "Bold",
      "Bond",
      "BondCount",
      "BondList",
      "BondQ",
      "Bookmarks",
      "Boole",
      "BooleanConsecutiveFunction",
      "BooleanConvert",
      "BooleanCountingFunction",
      "BooleanFunction",
      "BooleanGraph",
      "BooleanMaxterms",
      "BooleanMinimize",
      "BooleanMinterms",
      "BooleanQ",
      "BooleanRegion",
      "Booleans",
      "BooleanStrings",
      "BooleanTable",
      "BooleanVariables",
      "BorderDimensions",
      "BorelTannerDistribution",
      "Bottom",
      "BottomHatTransform",
      "BoundaryDiscretizeGraphics",
      "BoundaryDiscretizeRegion",
      "BoundaryMesh",
      "BoundaryMeshRegion",
      "BoundaryMeshRegionQ",
      "BoundaryStyle",
      "BoundedRegionQ",
      "BoundingRegion",
      "Bounds",
      "Box",
      "BoxBaselineShift",
      "BoxData",
      "BoxDimensions",
      "Boxed",
      "Boxes",
      "BoxForm",
      "BoxFormFormatTypes",
      "BoxFrame",
      "BoxID",
      "BoxMargins",
      "BoxMatrix",
      "BoxObject",
      "BoxRatios",
      "BoxRotation",
      "BoxRotationPoint",
      "BoxStyle",
      "BoxWhiskerChart",
      "Bra",
      "BracketingBar",
      "BraKet",
      "BrayCurtisDistance",
      "BreadthFirstScan",
      "Break",
      "BridgeData",
      "BrightnessEqualize",
      "BroadcastStationData",
      "Brown",
      "BrownForsytheTest",
      "BrownianBridgeProcess",
      "BrowserCategory",
      "BSplineBasis",
      "BSplineCurve",
      "BSplineCurve3DBox",
      "BSplineCurve3DBoxOptions",
      "BSplineCurveBox",
      "BSplineCurveBoxOptions",
      "BSplineFunction",
      "BSplineSurface",
      "BSplineSurface3DBox",
      "BSplineSurface3DBoxOptions",
      "BubbleChart",
      "BubbleChart3D",
      "BubbleScale",
      "BubbleSizes",
      "BuildingData",
      "BulletGauge",
      "BusinessDayQ",
      "ButterflyGraph",
      "ButterworthFilterModel",
      "Button",
      "ButtonBar",
      "ButtonBox",
      "ButtonBoxOptions",
      "ButtonCell",
      "ButtonContents",
      "ButtonData",
      "ButtonEvaluator",
      "ButtonExpandable",
      "ButtonFrame",
      "ButtonFunction",
      "ButtonMargins",
      "ButtonMinHeight",
      "ButtonNote",
      "ButtonNotebook",
      "ButtonSource",
      "ButtonStyle",
      "ButtonStyleMenuListing",
      "Byte",
      "ByteArray",
      "ByteArrayFormat",
      "ByteArrayQ",
      "ByteArrayToString",
      "ByteCount",
      "ByteOrdering",
      "C",
      "CachedValue",
      "CacheGraphics",
      "CachePersistence",
      "CalendarConvert",
      "CalendarData",
      "CalendarType",
      "Callout",
      "CalloutMarker",
      "CalloutStyle",
      "CallPacket",
      "CanberraDistance",
      "Cancel",
      "CancelButton",
      "CandlestickChart",
      "CanonicalGraph",
      "CanonicalizePolygon",
      "CanonicalizePolyhedron",
      "CanonicalName",
      "CanonicalWarpingCorrespondence",
      "CanonicalWarpingDistance",
      "CantorMesh",
      "CantorStaircase",
      "Cap",
      "CapForm",
      "CapitalDifferentialD",
      "Capitalize",
      "CapsuleShape",
      "CaptureRunning",
      "CardinalBSplineBasis",
      "CarlemanLinearize",
      "CarmichaelLambda",
      "CaseOrdering",
      "Cases",
      "CaseSensitive",
      "Cashflow",
      "Casoratian",
      "Catalan",
      "CatalanNumber",
      "Catch",
      "CategoricalDistribution",
      "Catenate",
      "CatenateLayer",
      "CauchyDistribution",
      "CauchyWindow",
      "CayleyGraph",
      "CDF",
      "CDFDeploy",
      "CDFInformation",
      "CDFWavelet",
      "Ceiling",
      "CelestialSystem",
      "Cell",
      "CellAutoOverwrite",
      "CellBaseline",
      "CellBoundingBox",
      "CellBracketOptions",
      "CellChangeTimes",
      "CellContents",
      "CellContext",
      "CellDingbat",
      "CellDynamicExpression",
      "CellEditDuplicate",
      "CellElementsBoundingBox",
      "CellElementSpacings",
      "CellEpilog",
      "CellEvaluationDuplicate",
      "CellEvaluationFunction",
      "CellEvaluationLanguage",
      "CellEventActions",
      "CellFrame",
      "CellFrameColor",
      "CellFrameLabelMargins",
      "CellFrameLabels",
      "CellFrameMargins",
      "CellGroup",
      "CellGroupData",
      "CellGrouping",
      "CellGroupingRules",
      "CellHorizontalScrolling",
      "CellID",
      "CellLabel",
      "CellLabelAutoDelete",
      "CellLabelMargins",
      "CellLabelPositioning",
      "CellLabelStyle",
      "CellLabelTemplate",
      "CellMargins",
      "CellObject",
      "CellOpen",
      "CellPrint",
      "CellProlog",
      "Cells",
      "CellSize",
      "CellStyle",
      "CellTags",
      "CellularAutomaton",
      "CensoredDistribution",
      "Censoring",
      "Center",
      "CenterArray",
      "CenterDot",
      "CentralFeature",
      "CentralMoment",
      "CentralMomentGeneratingFunction",
      "Cepstrogram",
      "CepstrogramArray",
      "CepstrumArray",
      "CForm",
      "ChampernowneNumber",
      "ChangeOptions",
      "ChannelBase",
      "ChannelBrokerAction",
      "ChannelDatabin",
      "ChannelHistoryLength",
      "ChannelListen",
      "ChannelListener",
      "ChannelListeners",
      "ChannelListenerWait",
      "ChannelObject",
      "ChannelPreSendFunction",
      "ChannelReceiverFunction",
      "ChannelSend",
      "ChannelSubscribers",
      "ChanVeseBinarize",
      "Character",
      "CharacterCounts",
      "CharacterEncoding",
      "CharacterEncodingsPath",
      "CharacteristicFunction",
      "CharacteristicPolynomial",
      "CharacterName",
      "CharacterNormalize",
      "CharacterRange",
      "Characters",
      "ChartBaseStyle",
      "ChartElementData",
      "ChartElementDataFunction",
      "ChartElementFunction",
      "ChartElements",
      "ChartLabels",
      "ChartLayout",
      "ChartLegends",
      "ChartStyle",
      "Chebyshev1FilterModel",
      "Chebyshev2FilterModel",
      "ChebyshevDistance",
      "ChebyshevT",
      "ChebyshevU",
      "Check",
      "CheckAbort",
      "CheckAll",
      "Checkbox",
      "CheckboxBar",
      "CheckboxBox",
      "CheckboxBoxOptions",
      "ChemicalData",
      "ChessboardDistance",
      "ChiDistribution",
      "ChineseRemainder",
      "ChiSquareDistribution",
      "ChoiceButtons",
      "ChoiceDialog",
      "CholeskyDecomposition",
      "Chop",
      "ChromaticityPlot",
      "ChromaticityPlot3D",
      "ChromaticPolynomial",
      "Circle",
      "CircleBox",
      "CircleDot",
      "CircleMinus",
      "CirclePlus",
      "CirclePoints",
      "CircleThrough",
      "CircleTimes",
      "CirculantGraph",
      "CircularOrthogonalMatrixDistribution",
      "CircularQuaternionMatrixDistribution",
      "CircularRealMatrixDistribution",
      "CircularSymplecticMatrixDistribution",
      "CircularUnitaryMatrixDistribution",
      "Circumsphere",
      "CityData",
      "ClassifierFunction",
      "ClassifierInformation",
      "ClassifierMeasurements",
      "ClassifierMeasurementsObject",
      "Classify",
      "ClassPriors",
      "Clear",
      "ClearAll",
      "ClearAttributes",
      "ClearCookies",
      "ClearPermissions",
      "ClearSystemCache",
      "ClebschGordan",
      "ClickPane",
      "Clip",
      "ClipboardNotebook",
      "ClipFill",
      "ClippingStyle",
      "ClipPlanes",
      "ClipPlanesStyle",
      "ClipRange",
      "Clock",
      "ClockGauge",
      "ClockwiseContourIntegral",
      "Close",
      "Closed",
      "CloseKernels",
      "ClosenessCentrality",
      "Closing",
      "ClosingAutoSave",
      "ClosingEvent",
      "ClosingSaveDialog",
      "CloudAccountData",
      "CloudBase",
      "CloudConnect",
      "CloudConnections",
      "CloudDeploy",
      "CloudDirectory",
      "CloudDisconnect",
      "CloudEvaluate",
      "CloudExport",
      "CloudExpression",
      "CloudExpressions",
      "CloudFunction",
      "CloudGet",
      "CloudImport",
      "CloudLoggingData",
      "CloudObject",
      "CloudObjectInformation",
      "CloudObjectInformationData",
      "CloudObjectNameFormat",
      "CloudObjects",
      "CloudObjectURLType",
      "CloudPublish",
      "CloudPut",
      "CloudRenderingMethod",
      "CloudSave",
      "CloudShare",
      "CloudSubmit",
      "CloudSymbol",
      "CloudUnshare",
      "CloudUserID",
      "ClusterClassify",
      "ClusterDissimilarityFunction",
      "ClusteringComponents",
      "ClusteringTree",
      "CMYKColor",
      "Coarse",
      "CodeAssistOptions",
      "Coefficient",
      "CoefficientArrays",
      "CoefficientDomain",
      "CoefficientList",
      "CoefficientRules",
      "CoifletWavelet",
      "Collect",
      "Colon",
      "ColonForm",
      "ColorBalance",
      "ColorCombine",
      "ColorConvert",
      "ColorCoverage",
      "ColorData",
      "ColorDataFunction",
      "ColorDetect",
      "ColorDistance",
      "ColorFunction",
      "ColorFunctionScaling",
      "Colorize",
      "ColorNegate",
      "ColorOutput",
      "ColorProfileData",
      "ColorQ",
      "ColorQuantize",
      "ColorReplace",
      "ColorRules",
      "ColorSelectorSettings",
      "ColorSeparate",
      "ColorSetter",
      "ColorSetterBox",
      "ColorSetterBoxOptions",
      "ColorSlider",
      "ColorsNear",
      "ColorSpace",
      "ColorToneMapping",
      "Column",
      "ColumnAlignments",
      "ColumnBackgrounds",
      "ColumnForm",
      "ColumnLines",
      "ColumnsEqual",
      "ColumnSpacings",
      "ColumnWidths",
      "CombinedEntityClass",
      "CombinerFunction",
      "CometData",
      "CommonDefaultFormatTypes",
      "Commonest",
      "CommonestFilter",
      "CommonName",
      "CommonUnits",
      "CommunityBoundaryStyle",
      "CommunityGraphPlot",
      "CommunityLabels",
      "CommunityRegionStyle",
      "CompanyData",
      "CompatibleUnitQ",
      "CompilationOptions",
      "CompilationTarget",
      "Compile",
      "Compiled",
      "CompiledCodeFunction",
      "CompiledFunction",
      "CompilerOptions",
      "Complement",
      "ComplementedEntityClass",
      "CompleteGraph",
      "CompleteGraphQ",
      "CompleteKaryTree",
      "CompletionsListPacket",
      "Complex",
      "ComplexContourPlot",
      "Complexes",
      "ComplexExpand",
      "ComplexInfinity",
      "ComplexityFunction",
      "ComplexListPlot",
      "ComplexPlot",
      "ComplexPlot3D",
      "ComplexRegionPlot",
      "ComplexStreamPlot",
      "ComplexVectorPlot",
      "ComponentMeasurements",
      "ComponentwiseContextMenu",
      "Compose",
      "ComposeList",
      "ComposeSeries",
      "CompositeQ",
      "Composition",
      "CompoundElement",
      "CompoundExpression",
      "CompoundPoissonDistribution",
      "CompoundPoissonProcess",
      "CompoundRenewalProcess",
      "Compress",
      "CompressedData",
      "CompressionLevel",
      "ComputeUncertainty",
      "Condition",
      "ConditionalExpression",
      "Conditioned",
      "Cone",
      "ConeBox",
      "ConfidenceLevel",
      "ConfidenceRange",
      "ConfidenceTransform",
      "ConfigurationPath",
      "ConformAudio",
      "ConformImages",
      "Congruent",
      "ConicHullRegion",
      "ConicHullRegion3DBox",
      "ConicHullRegionBox",
      "ConicOptimization",
      "Conjugate",
      "ConjugateTranspose",
      "Conjunction",
      "Connect",
      "ConnectedComponents",
      "ConnectedGraphComponents",
      "ConnectedGraphQ",
      "ConnectedMeshComponents",
      "ConnectedMoleculeComponents",
      "ConnectedMoleculeQ",
      "ConnectionSettings",
      "ConnectLibraryCallbackFunction",
      "ConnectSystemModelComponents",
      "ConnesWindow",
      "ConoverTest",
      "ConsoleMessage",
      "ConsoleMessagePacket",
      "Constant",
      "ConstantArray",
      "ConstantArrayLayer",
      "ConstantImage",
      "ConstantPlusLayer",
      "ConstantRegionQ",
      "Constants",
      "ConstantTimesLayer",
      "ConstellationData",
      "ConstrainedMax",
      "ConstrainedMin",
      "Construct",
      "Containing",
      "ContainsAll",
      "ContainsAny",
      "ContainsExactly",
      "ContainsNone",
      "ContainsOnly",
      "ContentFieldOptions",
      "ContentLocationFunction",
      "ContentObject",
      "ContentPadding",
      "ContentsBoundingBox",
      "ContentSelectable",
      "ContentSize",
      "Context",
      "ContextMenu",
      "Contexts",
      "ContextToFileName",
      "Continuation",
      "Continue",
      "ContinuedFraction",
      "ContinuedFractionK",
      "ContinuousAction",
      "ContinuousMarkovProcess",
      "ContinuousTask",
      "ContinuousTimeModelQ",
      "ContinuousWaveletData",
      "ContinuousWaveletTransform",
      "ContourDetect",
      "ContourGraphics",
      "ContourIntegral",
      "ContourLabels",
      "ContourLines",
      "ContourPlot",
      "ContourPlot3D",
      "Contours",
      "ContourShading",
      "ContourSmoothing",
      "ContourStyle",
      "ContraharmonicMean",
      "ContrastiveLossLayer",
      "Control",
      "ControlActive",
      "ControlAlignment",
      "ControlGroupContentsBox",
      "ControllabilityGramian",
      "ControllabilityMatrix",
      "ControllableDecomposition",
      "ControllableModelQ",
      "ControllerDuration",
      "ControllerInformation",
      "ControllerInformationData",
      "ControllerLinking",
      "ControllerManipulate",
      "ControllerMethod",
      "ControllerPath",
      "ControllerState",
      "ControlPlacement",
      "ControlsRendering",
      "ControlType",
      "Convergents",
      "ConversionOptions",
      "ConversionRules",
      "ConvertToBitmapPacket",
      "ConvertToPostScript",
      "ConvertToPostScriptPacket",
      "ConvexHullMesh",
      "ConvexPolygonQ",
      "ConvexPolyhedronQ",
      "ConvolutionLayer",
      "Convolve",
      "ConwayGroupCo1",
      "ConwayGroupCo2",
      "ConwayGroupCo3",
      "CookieFunction",
      "Cookies",
      "CoordinateBoundingBox",
      "CoordinateBoundingBoxArray",
      "CoordinateBounds",
      "CoordinateBoundsArray",
      "CoordinateChartData",
      "CoordinatesToolOptions",
      "CoordinateTransform",
      "CoordinateTransformData",
      "CoprimeQ",
      "Coproduct",
      "CopulaDistribution",
      "Copyable",
      "CopyDatabin",
      "CopyDirectory",
      "CopyFile",
      "CopyTag",
      "CopyToClipboard",
      "CornerFilter",
      "CornerNeighbors",
      "Correlation",
      "CorrelationDistance",
      "CorrelationFunction",
      "CorrelationTest",
      "Cos",
      "Cosh",
      "CoshIntegral",
      "CosineDistance",
      "CosineWindow",
      "CosIntegral",
      "Cot",
      "Coth",
      "Count",
      "CountDistinct",
      "CountDistinctBy",
      "CounterAssignments",
      "CounterBox",
      "CounterBoxOptions",
      "CounterClockwiseContourIntegral",
      "CounterEvaluator",
      "CounterFunction",
      "CounterIncrements",
      "CounterStyle",
      "CounterStyleMenuListing",
      "CountRoots",
      "CountryData",
      "Counts",
      "CountsBy",
      "Covariance",
      "CovarianceEstimatorFunction",
      "CovarianceFunction",
      "CoxianDistribution",
      "CoxIngersollRossProcess",
      "CoxModel",
      "CoxModelFit",
      "CramerVonMisesTest",
      "CreateArchive",
      "CreateCellID",
      "CreateChannel",
      "CreateCloudExpression",
      "CreateDatabin",
      "CreateDataStructure",
      "CreateDataSystemModel",
      "CreateDialog",
      "CreateDirectory",
      "CreateDocument",
      "CreateFile",
      "CreateIntermediateDirectories",
      "CreateManagedLibraryExpression",
      "CreateNotebook",
      "CreatePacletArchive",
      "CreatePalette",
      "CreatePalettePacket",
      "CreatePermissionsGroup",
      "CreateScheduledTask",
      "CreateSearchIndex",
      "CreateSystemModel",
      "CreateTemporary",
      "CreateUUID",
      "CreateWindow",
      "CriterionFunction",
      "CriticalityFailureImportance",
      "CriticalitySuccessImportance",
      "CriticalSection",
      "Cross",
      "CrossEntropyLossLayer",
      "CrossingCount",
      "CrossingDetect",
      "CrossingPolygon",
      "CrossMatrix",
      "Csc",
      "Csch",
      "CTCLossLayer",
      "Cube",
      "CubeRoot",
      "Cubics",
      "Cuboid",
      "CuboidBox",
      "Cumulant",
      "CumulantGeneratingFunction",
      "Cup",
      "CupCap",
      "Curl",
      "CurlyDoubleQuote",
      "CurlyQuote",
      "CurrencyConvert",
      "CurrentDate",
      "CurrentImage",
      "CurrentlySpeakingPacket",
      "CurrentNotebookImage",
      "CurrentScreenImage",
      "CurrentValue",
      "Curry",
      "CurryApplied",
      "CurvatureFlowFilter",
      "CurveClosed",
      "Cyan",
      "CycleGraph",
      "CycleIndexPolynomial",
      "Cycles",
      "CyclicGroup",
      "Cyclotomic",
      "Cylinder",
      "CylinderBox",
      "CylindricalDecomposition",
      "D",
      "DagumDistribution",
      "DamData",
      "DamerauLevenshteinDistance",
      "DampingFactor",
      "Darker",
      "Dashed",
      "Dashing",
      "DatabaseConnect",
      "DatabaseDisconnect",
      "DatabaseReference",
      "Databin",
      "DatabinAdd",
      "DatabinRemove",
      "Databins",
      "DatabinUpload",
      "DataCompression",
      "DataDistribution",
      "DataRange",
      "DataReversed",
      "Dataset",
      "DatasetDisplayPanel",
      "DataStructure",
      "DataStructureQ",
      "Date",
      "DateBounds",
      "Dated",
      "DateDelimiters",
      "DateDifference",
      "DatedUnit",
      "DateFormat",
      "DateFunction",
      "DateHistogram",
      "DateInterval",
      "DateList",
      "DateListLogPlot",
      "DateListPlot",
      "DateListStepPlot",
      "DateObject",
      "DateObjectQ",
      "DateOverlapsQ",
      "DatePattern",
      "DatePlus",
      "DateRange",
      "DateReduction",
      "DateString",
      "DateTicksFormat",
      "DateValue",
      "DateWithinQ",
      "DaubechiesWavelet",
      "DavisDistribution",
      "DawsonF",
      "DayCount",
      "DayCountConvention",
      "DayHemisphere",
      "DaylightQ",
      "DayMatchQ",
      "DayName",
      "DayNightTerminator",
      "DayPlus",
      "DayRange",
      "DayRound",
      "DeBruijnGraph",
      "DeBruijnSequence",
      "Debug",
      "DebugTag",
      "Decapitalize",
      "Decimal",
      "DecimalForm",
      "DeclareKnownSymbols",
      "DeclarePackage",
      "Decompose",
      "DeconvolutionLayer",
      "Decrement",
      "Decrypt",
      "DecryptFile",
      "DedekindEta",
      "DeepSpaceProbeData",
      "Default",
      "DefaultAxesStyle",
      "DefaultBaseStyle",
      "DefaultBoxStyle",
      "DefaultButton",
      "DefaultColor",
      "DefaultControlPlacement",
      "DefaultDuplicateCellStyle",
      "DefaultDuration",
      "DefaultElement",
      "DefaultFaceGridsStyle",
      "DefaultFieldHintStyle",
      "DefaultFont",
      "DefaultFontProperties",
      "DefaultFormatType",
      "DefaultFormatTypeForStyle",
      "DefaultFrameStyle",
      "DefaultFrameTicksStyle",
      "DefaultGridLinesStyle",
      "DefaultInlineFormatType",
      "DefaultInputFormatType",
      "DefaultLabelStyle",
      "DefaultMenuStyle",
      "DefaultNaturalLanguage",
      "DefaultNewCellStyle",
      "DefaultNewInlineCellStyle",
      "DefaultNotebook",
      "DefaultOptions",
      "DefaultOutputFormatType",
      "DefaultPrintPrecision",
      "DefaultStyle",
      "DefaultStyleDefinitions",
      "DefaultTextFormatType",
      "DefaultTextInlineFormatType",
      "DefaultTicksStyle",
      "DefaultTooltipStyle",
      "DefaultValue",
      "DefaultValues",
      "Defer",
      "DefineExternal",
      "DefineInputStreamMethod",
      "DefineOutputStreamMethod",
      "DefineResourceFunction",
      "Definition",
      "Degree",
      "DegreeCentrality",
      "DegreeGraphDistribution",
      "DegreeLexicographic",
      "DegreeReverseLexicographic",
      "DEigensystem",
      "DEigenvalues",
      "Deinitialization",
      "Del",
      "DelaunayMesh",
      "Delayed",
      "Deletable",
      "Delete",
      "DeleteAnomalies",
      "DeleteBorderComponents",
      "DeleteCases",
      "DeleteChannel",
      "DeleteCloudExpression",
      "DeleteContents",
      "DeleteDirectory",
      "DeleteDuplicates",
      "DeleteDuplicatesBy",
      "DeleteFile",
      "DeleteMissing",
      "DeleteObject",
      "DeletePermissionsKey",
      "DeleteSearchIndex",
      "DeleteSmallComponents",
      "DeleteStopwords",
      "DeleteWithContents",
      "DeletionWarning",
      "DelimitedArray",
      "DelimitedSequence",
      "Delimiter",
      "DelimiterFlashTime",
      "DelimiterMatching",
      "Delimiters",
      "DeliveryFunction",
      "Dendrogram",
      "Denominator",
      "DensityGraphics",
      "DensityHistogram",
      "DensityPlot",
      "DensityPlot3D",
      "DependentVariables",
      "Deploy",
      "Deployed",
      "Depth",
      "DepthFirstScan",
      "Derivative",
      "DerivativeFilter",
      "DerivedKey",
      "DescriptorStateSpace",
      "DesignMatrix",
      "DestroyAfterEvaluation",
      "Det",
      "DeviceClose",
      "DeviceConfigure",
      "DeviceExecute",
      "DeviceExecuteAsynchronous",
      "DeviceObject",
      "DeviceOpen",
      "DeviceOpenQ",
      "DeviceRead",
      "DeviceReadBuffer",
      "DeviceReadLatest",
      "DeviceReadList",
      "DeviceReadTimeSeries",
      "Devices",
      "DeviceStreams",
      "DeviceWrite",
      "DeviceWriteBuffer",
      "DGaussianWavelet",
      "DiacriticalPositioning",
      "Diagonal",
      "DiagonalizableMatrixQ",
      "DiagonalMatrix",
      "DiagonalMatrixQ",
      "Dialog",
      "DialogIndent",
      "DialogInput",
      "DialogLevel",
      "DialogNotebook",
      "DialogProlog",
      "DialogReturn",
      "DialogSymbols",
      "Diamond",
      "DiamondMatrix",
      "DiceDissimilarity",
      "DictionaryLookup",
      "DictionaryWordQ",
      "DifferenceDelta",
      "DifferenceOrder",
      "DifferenceQuotient",
      "DifferenceRoot",
      "DifferenceRootReduce",
      "Differences",
      "DifferentialD",
      "DifferentialRoot",
      "DifferentialRootReduce",
      "DifferentiatorFilter",
      "DigitalSignature",
      "DigitBlock",
      "DigitBlockMinimum",
      "DigitCharacter",
      "DigitCount",
      "DigitQ",
      "DihedralAngle",
      "DihedralGroup",
      "Dilation",
      "DimensionalCombinations",
      "DimensionalMeshComponents",
      "DimensionReduce",
      "DimensionReducerFunction",
      "DimensionReduction",
      "Dimensions",
      "DiracComb",
      "DiracDelta",
      "DirectedEdge",
      "DirectedEdges",
      "DirectedGraph",
      "DirectedGraphQ",
      "DirectedInfinity",
      "Direction",
      "Directive",
      "Directory",
      "DirectoryName",
      "DirectoryQ",
      "DirectoryStack",
      "DirichletBeta",
      "DirichletCharacter",
      "DirichletCondition",
      "DirichletConvolve",
      "DirichletDistribution",
      "DirichletEta",
      "DirichletL",
      "DirichletLambda",
      "DirichletTransform",
      "DirichletWindow",
      "DisableConsolePrintPacket",
      "DisableFormatting",
      "DiscreteAsymptotic",
      "DiscreteChirpZTransform",
      "DiscreteConvolve",
      "DiscreteDelta",
      "DiscreteHadamardTransform",
      "DiscreteIndicator",
      "DiscreteLimit",
      "DiscreteLQEstimatorGains",
      "DiscreteLQRegulatorGains",
      "DiscreteLyapunovSolve",
      "DiscreteMarkovProcess",
      "DiscreteMaxLimit",
      "DiscreteMinLimit",
      "DiscretePlot",
      "DiscretePlot3D",
      "DiscreteRatio",
      "DiscreteRiccatiSolve",
      "DiscreteShift",
      "DiscreteTimeModelQ",
      "DiscreteUniformDistribution",
      "DiscreteVariables",
      "DiscreteWaveletData",
      "DiscreteWaveletPacketTransform",
      "DiscreteWaveletTransform",
      "DiscretizeGraphics",
      "DiscretizeRegion",
      "Discriminant",
      "DisjointQ",
      "Disjunction",
      "Disk",
      "DiskBox",
      "DiskMatrix",
      "DiskSegment",
      "Dispatch",
      "DispatchQ",
      "DispersionEstimatorFunction",
      "Display",
      "DisplayAllSteps",
      "DisplayEndPacket",
      "DisplayFlushImagePacket",
      "DisplayForm",
      "DisplayFunction",
      "DisplayPacket",
      "DisplayRules",
      "DisplaySetSizePacket",
      "DisplayString",
      "DisplayTemporary",
      "DisplayWith",
      "DisplayWithRef",
      "DisplayWithVariable",
      "DistanceFunction",
      "DistanceMatrix",
      "DistanceTransform",
      "Distribute",
      "Distributed",
      "DistributedContexts",
      "DistributeDefinitions",
      "DistributionChart",
      "DistributionDomain",
      "DistributionFitTest",
      "DistributionParameterAssumptions",
      "DistributionParameterQ",
      "Dithering",
      "Div",
      "Divergence",
      "Divide",
      "DivideBy",
      "Dividers",
      "DivideSides",
      "Divisible",
      "Divisors",
      "DivisorSigma",
      "DivisorSum",
      "DMSList",
      "DMSString",
      "Do",
      "DockedCells",
      "DocumentGenerator",
      "DocumentGeneratorInformation",
      "DocumentGeneratorInformationData",
      "DocumentGenerators",
      "DocumentNotebook",
      "DocumentWeightingRules",
      "Dodecahedron",
      "DomainRegistrationInformation",
      "DominantColors",
      "DOSTextFormat",
      "Dot",
      "DotDashed",
      "DotEqual",
      "DotLayer",
      "DotPlusLayer",
      "Dotted",
      "DoubleBracketingBar",
      "DoubleContourIntegral",
      "DoubleDownArrow",
      "DoubleLeftArrow",
      "DoubleLeftRightArrow",
      "DoubleLeftTee",
      "DoubleLongLeftArrow",
      "DoubleLongLeftRightArrow",
      "DoubleLongRightArrow",
      "DoubleRightArrow",
      "DoubleRightTee",
      "DoubleUpArrow",
      "DoubleUpDownArrow",
      "DoubleVerticalBar",
      "DoublyInfinite",
      "Down",
      "DownArrow",
      "DownArrowBar",
      "DownArrowUpArrow",
      "DownLeftRightVector",
      "DownLeftTeeVector",
      "DownLeftVector",
      "DownLeftVectorBar",
      "DownRightTeeVector",
      "DownRightVector",
      "DownRightVectorBar",
      "Downsample",
      "DownTee",
      "DownTeeArrow",
      "DownValues",
      "DragAndDrop",
      "DrawEdges",
      "DrawFrontFaces",
      "DrawHighlighted",
      "Drop",
      "DropoutLayer",
      "DSolve",
      "DSolveValue",
      "Dt",
      "DualLinearProgramming",
      "DualPolyhedron",
      "DualSystemsModel",
      "DumpGet",
      "DumpSave",
      "DuplicateFreeQ",
      "Duration",
      "Dynamic",
      "DynamicBox",
      "DynamicBoxOptions",
      "DynamicEvaluationTimeout",
      "DynamicGeoGraphics",
      "DynamicImage",
      "DynamicLocation",
      "DynamicModule",
      "DynamicModuleBox",
      "DynamicModuleBoxOptions",
      "DynamicModuleParent",
      "DynamicModuleValues",
      "DynamicName",
      "DynamicNamespace",
      "DynamicReference",
      "DynamicSetting",
      "DynamicUpdating",
      "DynamicWrapper",
      "DynamicWrapperBox",
      "DynamicWrapperBoxOptions",
      "E",
      "EarthImpactData",
      "EarthquakeData",
      "EccentricityCentrality",
      "Echo",
      "EchoFunction",
      "EclipseType",
      "EdgeAdd",
      "EdgeBetweennessCentrality",
      "EdgeCapacity",
      "EdgeCapForm",
      "EdgeColor",
      "EdgeConnectivity",
      "EdgeContract",
      "EdgeCost",
      "EdgeCount",
      "EdgeCoverQ",
      "EdgeCycleMatrix",
      "EdgeDashing",
      "EdgeDelete",
      "EdgeDetect",
      "EdgeForm",
      "EdgeIndex",
      "EdgeJoinForm",
      "EdgeLabeling",
      "EdgeLabels",
      "EdgeLabelStyle",
      "EdgeList",
      "EdgeOpacity",
      "EdgeQ",
      "EdgeRenderingFunction",
      "EdgeRules",
      "EdgeShapeFunction",
      "EdgeStyle",
      "EdgeTaggedGraph",
      "EdgeTaggedGraphQ",
      "EdgeTags",
      "EdgeThickness",
      "EdgeWeight",
      "EdgeWeightedGraphQ",
      "Editable",
      "EditButtonSettings",
      "EditCellTagsSettings",
      "EditDistance",
      "EffectiveInterest",
      "Eigensystem",
      "Eigenvalues",
      "EigenvectorCentrality",
      "Eigenvectors",
      "Element",
      "ElementData",
      "ElementwiseLayer",
      "ElidedForms",
      "Eliminate",
      "EliminationOrder",
      "Ellipsoid",
      "EllipticE",
      "EllipticExp",
      "EllipticExpPrime",
      "EllipticF",
      "EllipticFilterModel",
      "EllipticK",
      "EllipticLog",
      "EllipticNomeQ",
      "EllipticPi",
      "EllipticReducedHalfPeriods",
      "EllipticTheta",
      "EllipticThetaPrime",
      "EmbedCode",
      "EmbeddedHTML",
      "EmbeddedService",
      "EmbeddingLayer",
      "EmbeddingObject",
      "EmitSound",
      "EmphasizeSyntaxErrors",
      "EmpiricalDistribution",
      "Empty",
      "EmptyGraphQ",
      "EmptyRegion",
      "EnableConsolePrintPacket",
      "Enabled",
      "Encode",
      "Encrypt",
      "EncryptedObject",
      "EncryptFile",
      "End",
      "EndAdd",
      "EndDialogPacket",
      "EndFrontEndInteractionPacket",
      "EndOfBuffer",
      "EndOfFile",
      "EndOfLine",
      "EndOfString",
      "EndPackage",
      "EngineEnvironment",
      "EngineeringForm",
      "Enter",
      "EnterExpressionPacket",
      "EnterTextPacket",
      "Entity",
      "EntityClass",
      "EntityClassList",
      "EntityCopies",
      "EntityFunction",
      "EntityGroup",
      "EntityInstance",
      "EntityList",
      "EntityPrefetch",
      "EntityProperties",
      "EntityProperty",
      "EntityPropertyClass",
      "EntityRegister",
      "EntityStore",
      "EntityStores",
      "EntityTypeName",
      "EntityUnregister",
      "EntityValue",
      "Entropy",
      "EntropyFilter",
      "Environment",
      "Epilog",
      "EpilogFunction",
      "Equal",
      "EqualColumns",
      "EqualRows",
      "EqualTilde",
      "EqualTo",
      "EquatedTo",
      "Equilibrium",
      "EquirippleFilterKernel",
      "Equivalent",
      "Erf",
      "Erfc",
      "Erfi",
      "ErlangB",
      "ErlangC",
      "ErlangDistribution",
      "Erosion",
      "ErrorBox",
      "ErrorBoxOptions",
      "ErrorNorm",
      "ErrorPacket",
      "ErrorsDialogSettings",
      "EscapeRadius",
      "EstimatedBackground",
      "EstimatedDistribution",
      "EstimatedProcess",
      "EstimatorGains",
      "EstimatorRegulator",
      "EuclideanDistance",
      "EulerAngles",
      "EulerCharacteristic",
      "EulerE",
      "EulerGamma",
      "EulerianGraphQ",
      "EulerMatrix",
      "EulerPhi",
      "Evaluatable",
      "Evaluate",
      "Evaluated",
      "EvaluatePacket",
      "EvaluateScheduledTask",
      "EvaluationBox",
      "EvaluationCell",
      "EvaluationCompletionAction",
      "EvaluationData",
      "EvaluationElements",
      "EvaluationEnvironment",
      "EvaluationMode",
      "EvaluationMonitor",
      "EvaluationNotebook",
      "EvaluationObject",
      "EvaluationOrder",
      "Evaluator",
      "EvaluatorNames",
      "EvenQ",
      "EventData",
      "EventEvaluator",
      "EventHandler",
      "EventHandlerTag",
      "EventLabels",
      "EventSeries",
      "ExactBlackmanWindow",
      "ExactNumberQ",
      "ExactRootIsolation",
      "ExampleData",
      "Except",
      "ExcludedForms",
      "ExcludedLines",
      "ExcludedPhysicalQuantities",
      "ExcludePods",
      "Exclusions",
      "ExclusionsStyle",
      "Exists",
      "Exit",
      "ExitDialog",
      "ExoplanetData",
      "Exp",
      "Expand",
      "ExpandAll",
      "ExpandDenominator",
      "ExpandFileName",
      "ExpandNumerator",
      "Expectation",
      "ExpectationE",
      "ExpectedValue",
      "ExpGammaDistribution",
      "ExpIntegralE",
      "ExpIntegralEi",
      "ExpirationDate",
      "Exponent",
      "ExponentFunction",
      "ExponentialDistribution",
      "ExponentialFamily",
      "ExponentialGeneratingFunction",
      "ExponentialMovingAverage",
      "ExponentialPowerDistribution",
      "ExponentPosition",
      "ExponentStep",
      "Export",
      "ExportAutoReplacements",
      "ExportByteArray",
      "ExportForm",
      "ExportPacket",
      "ExportString",
      "Expression",
      "ExpressionCell",
      "ExpressionGraph",
      "ExpressionPacket",
      "ExpressionUUID",
      "ExpToTrig",
      "ExtendedEntityClass",
      "ExtendedGCD",
      "Extension",
      "ExtentElementFunction",
      "ExtentMarkers",
      "ExtentSize",
      "ExternalBundle",
      "ExternalCall",
      "ExternalDataCharacterEncoding",
      "ExternalEvaluate",
      "ExternalFunction",
      "ExternalFunctionName",
      "ExternalIdentifier",
      "ExternalObject",
      "ExternalOptions",
      "ExternalSessionObject",
      "ExternalSessions",
      "ExternalStorageBase",
      "ExternalStorageDownload",
      "ExternalStorageGet",
      "ExternalStorageObject",
      "ExternalStoragePut",
      "ExternalStorageUpload",
      "ExternalTypeSignature",
      "ExternalValue",
      "Extract",
      "ExtractArchive",
      "ExtractLayer",
      "ExtractPacletArchive",
      "ExtremeValueDistribution",
      "FaceAlign",
      "FaceForm",
      "FaceGrids",
      "FaceGridsStyle",
      "FacialFeatures",
      "Factor",
      "FactorComplete",
      "Factorial",
      "Factorial2",
      "FactorialMoment",
      "FactorialMomentGeneratingFunction",
      "FactorialPower",
      "FactorInteger",
      "FactorList",
      "FactorSquareFree",
      "FactorSquareFreeList",
      "FactorTerms",
      "FactorTermsList",
      "Fail",
      "Failure",
      "FailureAction",
      "FailureDistribution",
      "FailureQ",
      "False",
      "FareySequence",
      "FARIMAProcess",
      "FeatureDistance",
      "FeatureExtract",
      "FeatureExtraction",
      "FeatureExtractor",
      "FeatureExtractorFunction",
      "FeatureNames",
      "FeatureNearest",
      "FeatureSpacePlot",
      "FeatureSpacePlot3D",
      "FeatureTypes",
      "FEDisableConsolePrintPacket",
      "FeedbackLinearize",
      "FeedbackSector",
      "FeedbackSectorStyle",
      "FeedbackType",
      "FEEnableConsolePrintPacket",
      "FetalGrowthData",
      "Fibonacci",
      "Fibonorial",
      "FieldCompletionFunction",
      "FieldHint",
      "FieldHintStyle",
      "FieldMasked",
      "FieldSize",
      "File",
      "FileBaseName",
      "FileByteCount",
      "FileConvert",
      "FileDate",
      "FileExistsQ",
      "FileExtension",
      "FileFormat",
      "FileHandler",
      "FileHash",
      "FileInformation",
      "FileName",
      "FileNameDepth",
      "FileNameDialogSettings",
      "FileNameDrop",
      "FileNameForms",
      "FileNameJoin",
      "FileNames",
      "FileNameSetter",
      "FileNameSplit",
      "FileNameTake",
      "FilePrint",
      "FileSize",
      "FileSystemMap",
      "FileSystemScan",
      "FileTemplate",
      "FileTemplateApply",
      "FileType",
      "FilledCurve",
      "FilledCurveBox",
      "FilledCurveBoxOptions",
      "Filling",
      "FillingStyle",
      "FillingTransform",
      "FilteredEntityClass",
      "FilterRules",
      "FinancialBond",
      "FinancialData",
      "FinancialDerivative",
      "FinancialIndicator",
      "Find",
      "FindAnomalies",
      "FindArgMax",
      "FindArgMin",
      "FindChannels",
      "FindClique",
      "FindClusters",
      "FindCookies",
      "FindCurvePath",
      "FindCycle",
      "FindDevices",
      "FindDistribution",
      "FindDistributionParameters",
      "FindDivisions",
      "FindEdgeCover",
      "FindEdgeCut",
      "FindEdgeIndependentPaths",
      "FindEquationalProof",
      "FindEulerianCycle",
      "FindExternalEvaluators",
      "FindFaces",
      "FindFile",
      "FindFit",
      "FindFormula",
      "FindFundamentalCycles",
      "FindGeneratingFunction",
      "FindGeoLocation",
      "FindGeometricConjectures",
      "FindGeometricTransform",
      "FindGraphCommunities",
      "FindGraphIsomorphism",
      "FindGraphPartition",
      "FindHamiltonianCycle",
      "FindHamiltonianPath",
      "FindHiddenMarkovStates",
      "FindImageText",
      "FindIndependentEdgeSet",
      "FindIndependentVertexSet",
      "FindInstance",
      "FindIntegerNullVector",
      "FindKClan",
      "FindKClique",
      "FindKClub",
      "FindKPlex",
      "FindLibrary",
      "FindLinearRecurrence",
      "FindList",
      "FindMatchingColor",
      "FindMaximum",
      "FindMaximumCut",
      "FindMaximumFlow",
      "FindMaxValue",
      "FindMeshDefects",
      "FindMinimum",
      "FindMinimumCostFlow",
      "FindMinimumCut",
      "FindMinValue",
      "FindMoleculeSubstructure",
      "FindPath",
      "FindPeaks",
      "FindPermutation",
      "FindPostmanTour",
      "FindProcessParameters",
      "FindRepeat",
      "FindRoot",
      "FindSequenceFunction",
      "FindSettings",
      "FindShortestPath",
      "FindShortestTour",
      "FindSpanningTree",
      "FindSystemModelEquilibrium",
      "FindTextualAnswer",
      "FindThreshold",
      "FindTransientRepeat",
      "FindVertexCover",
      "FindVertexCut",
      "FindVertexIndependentPaths",
      "Fine",
      "FinishDynamic",
      "FiniteAbelianGroupCount",
      "FiniteGroupCount",
      "FiniteGroupData",
      "First",
      "FirstCase",
      "FirstPassageTimeDistribution",
      "FirstPosition",
      "FischerGroupFi22",
      "FischerGroupFi23",
      "FischerGroupFi24Prime",
      "FisherHypergeometricDistribution",
      "FisherRatioTest",
      "FisherZDistribution",
      "Fit",
      "FitAll",
      "FitRegularization",
      "FittedModel",
      "FixedOrder",
      "FixedPoint",
      "FixedPointList",
      "FlashSelection",
      "Flat",
      "Flatten",
      "FlattenAt",
      "FlattenLayer",
      "FlatTopWindow",
      "FlipView",
      "Floor",
      "FlowPolynomial",
      "FlushPrintOutputPacket",
      "Fold",
      "FoldList",
      "FoldPair",
      "FoldPairList",
      "FollowRedirects",
      "Font",
      "FontColor",
      "FontFamily",
      "FontForm",
      "FontName",
      "FontOpacity",
      "FontPostScriptName",
      "FontProperties",
      "FontReencoding",
      "FontSize",
      "FontSlant",
      "FontSubstitutions",
      "FontTracking",
      "FontVariations",
      "FontWeight",
      "For",
      "ForAll",
      "ForceVersionInstall",
      "Format",
      "FormatRules",
      "FormatType",
      "FormatTypeAutoConvert",
      "FormatValues",
      "FormBox",
      "FormBoxOptions",
      "FormControl",
      "FormFunction",
      "FormLayoutFunction",
      "FormObject",
      "FormPage",
      "FormTheme",
      "FormulaData",
      "FormulaLookup",
      "FortranForm",
      "Forward",
      "ForwardBackward",
      "Fourier",
      "FourierCoefficient",
      "FourierCosCoefficient",
      "FourierCosSeries",
      "FourierCosTransform",
      "FourierDCT",
      "FourierDCTFilter",
      "FourierDCTMatrix",
      "FourierDST",
      "FourierDSTMatrix",
      "FourierMatrix",
      "FourierParameters",
      "FourierSequenceTransform",
      "FourierSeries",
      "FourierSinCoefficient",
      "FourierSinSeries",
      "FourierSinTransform",
      "FourierTransform",
      "FourierTrigSeries",
      "FractionalBrownianMotionProcess",
      "FractionalGaussianNoiseProcess",
      "FractionalPart",
      "FractionBox",
      "FractionBoxOptions",
      "FractionLine",
      "Frame",
      "FrameBox",
      "FrameBoxOptions",
      "Framed",
      "FrameInset",
      "FrameLabel",
      "Frameless",
      "FrameMargins",
      "FrameRate",
      "FrameStyle",
      "FrameTicks",
      "FrameTicksStyle",
      "FRatioDistribution",
      "FrechetDistribution",
      "FreeQ",
      "FrenetSerretSystem",
      "FrequencySamplingFilterKernel",
      "FresnelC",
      "FresnelF",
      "FresnelG",
      "FresnelS",
      "Friday",
      "FrobeniusNumber",
      "FrobeniusSolve",
      "FromAbsoluteTime",
      "FromCharacterCode",
      "FromCoefficientRules",
      "FromContinuedFraction",
      "FromDate",
      "FromDigits",
      "FromDMS",
      "FromEntity",
      "FromJulianDate",
      "FromLetterNumber",
      "FromPolarCoordinates",
      "FromRomanNumeral",
      "FromSphericalCoordinates",
      "FromUnixTime",
      "Front",
      "FrontEndDynamicExpression",
      "FrontEndEventActions",
      "FrontEndExecute",
      "FrontEndObject",
      "FrontEndResource",
      "FrontEndResourceString",
      "FrontEndStackSize",
      "FrontEndToken",
      "FrontEndTokenExecute",
      "FrontEndValueCache",
      "FrontEndVersion",
      "FrontFaceColor",
      "FrontFaceOpacity",
      "Full",
      "FullAxes",
      "FullDefinition",
      "FullForm",
      "FullGraphics",
      "FullInformationOutputRegulator",
      "FullOptions",
      "FullRegion",
      "FullSimplify",
      "Function",
      "FunctionCompile",
      "FunctionCompileExport",
      "FunctionCompileExportByteArray",
      "FunctionCompileExportLibrary",
      "FunctionCompileExportString",
      "FunctionDomain",
      "FunctionExpand",
      "FunctionInterpolation",
      "FunctionPeriod",
      "FunctionRange",
      "FunctionSpace",
      "FussellVeselyImportance",
      "GaborFilter",
      "GaborMatrix",
      "GaborWavelet",
      "GainMargins",
      "GainPhaseMargins",
      "GalaxyData",
      "GalleryView",
      "Gamma",
      "GammaDistribution",
      "GammaRegularized",
      "GapPenalty",
      "GARCHProcess",
      "GatedRecurrentLayer",
      "Gather",
      "GatherBy",
      "GaugeFaceElementFunction",
      "GaugeFaceStyle",
      "GaugeFrameElementFunction",
      "GaugeFrameSize",
      "GaugeFrameStyle",
      "GaugeLabels",
      "GaugeMarkers",
      "GaugeStyle",
      "GaussianFilter",
      "GaussianIntegers",
      "GaussianMatrix",
      "GaussianOrthogonalMatrixDistribution",
      "GaussianSymplecticMatrixDistribution",
      "GaussianUnitaryMatrixDistribution",
      "GaussianWindow",
      "GCD",
      "GegenbauerC",
      "General",
      "GeneralizedLinearModelFit",
      "GenerateAsymmetricKeyPair",
      "GenerateConditions",
      "GeneratedCell",
      "GeneratedDocumentBinding",
      "GenerateDerivedKey",
      "GenerateDigitalSignature",
      "GenerateDocument",
      "GeneratedParameters",
      "GeneratedQuantityMagnitudes",
      "GenerateFileSignature",
      "GenerateHTTPResponse",
      "GenerateSecuredAuthenticationKey",
      "GenerateSymmetricKey",
      "GeneratingFunction",
      "GeneratorDescription",
      "GeneratorHistoryLength",
      "GeneratorOutputType",
      "Generic",
      "GenericCylindricalDecomposition",
      "GenomeData",
      "GenomeLookup",
      "GeoAntipode",
      "GeoArea",
      "GeoArraySize",
      "GeoBackground",
      "GeoBoundingBox",
      "GeoBounds",
      "GeoBoundsRegion",
      "GeoBubbleChart",
      "GeoCenter",
      "GeoCircle",
      "GeoContourPlot",
      "GeoDensityPlot",
      "GeodesicClosing",
      "GeodesicDilation",
      "GeodesicErosion",
      "GeodesicOpening",
      "GeoDestination",
      "GeodesyData",
      "GeoDirection",
      "GeoDisk",
      "GeoDisplacement",
      "GeoDistance",
      "GeoDistanceList",
      "GeoElevationData",
      "GeoEntities",
      "GeoGraphics",
      "GeogravityModelData",
      "GeoGridDirectionDifference",
      "GeoGridLines",
      "GeoGridLinesStyle",
      "GeoGridPosition",
      "GeoGridRange",
      "GeoGridRangePadding",
      "GeoGridUnitArea",
      "GeoGridUnitDistance",
      "GeoGridVector",
      "GeoGroup",
      "GeoHemisphere",
      "GeoHemisphereBoundary",
      "GeoHistogram",
      "GeoIdentify",
      "GeoImage",
      "GeoLabels",
      "GeoLength",
      "GeoListPlot",
      "GeoLocation",
      "GeologicalPeriodData",
      "GeomagneticModelData",
      "GeoMarker",
      "GeometricAssertion",
      "GeometricBrownianMotionProcess",
      "GeometricDistribution",
      "GeometricMean",
      "GeometricMeanFilter",
      "GeometricOptimization",
      "GeometricScene",
      "GeometricTransformation",
      "GeometricTransformation3DBox",
      "GeometricTransformation3DBoxOptions",
      "GeometricTransformationBox",
      "GeometricTransformationBoxOptions",
      "GeoModel",
      "GeoNearest",
      "GeoPath",
      "GeoPosition",
      "GeoPositionENU",
      "GeoPositionXYZ",
      "GeoProjection",
      "GeoProjectionData",
      "GeoRange",
      "GeoRangePadding",
      "GeoRegionValuePlot",
      "GeoResolution",
      "GeoScaleBar",
      "GeoServer",
      "GeoSmoothHistogram",
      "GeoStreamPlot",
      "GeoStyling",
      "GeoStylingImageFunction",
      "GeoVariant",
      "GeoVector",
      "GeoVectorENU",
      "GeoVectorPlot",
      "GeoVectorXYZ",
      "GeoVisibleRegion",
      "GeoVisibleRegionBoundary",
      "GeoWithinQ",
      "GeoZoomLevel",
      "GestureHandler",
      "GestureHandlerTag",
      "Get",
      "GetBoundingBoxSizePacket",
      "GetContext",
      "GetEnvironment",
      "GetFileName",
      "GetFrontEndOptionsDataPacket",
      "GetLinebreakInformationPacket",
      "GetMenusPacket",
      "GetPageBreakInformationPacket",
      "Glaisher",
      "GlobalClusteringCoefficient",
      "GlobalPreferences",
      "GlobalSession",
      "Glow",
      "GoldenAngle",
      "GoldenRatio",
      "GompertzMakehamDistribution",
      "GoochShading",
      "GoodmanKruskalGamma",
      "GoodmanKruskalGammaTest",
      "Goto",
      "Grad",
      "Gradient",
      "GradientFilter",
      "GradientOrientationFilter",
      "GrammarApply",
      "GrammarRules",
      "GrammarToken",
      "Graph",
      "Graph3D",
      "GraphAssortativity",
      "GraphAutomorphismGroup",
      "GraphCenter",
      "GraphComplement",
      "GraphData",
      "GraphDensity",
      "GraphDiameter",
      "GraphDifference",
      "GraphDisjointUnion",
      "GraphDistance",
      "GraphDistanceMatrix",
      "GraphElementData",
      "GraphEmbedding",
      "GraphHighlight",
      "GraphHighlightStyle",
      "GraphHub",
      "Graphics",
      "Graphics3D",
      "Graphics3DBox",
      "Graphics3DBoxOptions",
      "GraphicsArray",
      "GraphicsBaseline",
      "GraphicsBox",
      "GraphicsBoxOptions",
      "GraphicsColor",
      "GraphicsColumn",
      "GraphicsComplex",
      "GraphicsComplex3DBox",
      "GraphicsComplex3DBoxOptions",
      "GraphicsComplexBox",
      "GraphicsComplexBoxOptions",
      "GraphicsContents",
      "GraphicsData",
      "GraphicsGrid",
      "GraphicsGridBox",
      "GraphicsGroup",
      "GraphicsGroup3DBox",
      "GraphicsGroup3DBoxOptions",
      "GraphicsGroupBox",
      "GraphicsGroupBoxOptions",
      "GraphicsGrouping",
      "GraphicsHighlightColor",
      "GraphicsRow",
      "GraphicsSpacing",
      "GraphicsStyle",
      "GraphIntersection",
      "GraphLayout",
      "GraphLinkEfficiency",
      "GraphPeriphery",
      "GraphPlot",
      "GraphPlot3D",
      "GraphPower",
      "GraphPropertyDistribution",
      "GraphQ",
      "GraphRadius",
      "GraphReciprocity",
      "GraphRoot",
      "GraphStyle",
      "GraphUnion",
      "Gray",
      "GrayLevel",
      "Greater",
      "GreaterEqual",
      "GreaterEqualLess",
      "GreaterEqualThan",
      "GreaterFullEqual",
      "GreaterGreater",
      "GreaterLess",
      "GreaterSlantEqual",
      "GreaterThan",
      "GreaterTilde",
      "Green",
      "GreenFunction",
      "Grid",
      "GridBaseline",
      "GridBox",
      "GridBoxAlignment",
      "GridBoxBackground",
      "GridBoxDividers",
      "GridBoxFrame",
      "GridBoxItemSize",
      "GridBoxItemStyle",
      "GridBoxOptions",
      "GridBoxSpacings",
      "GridCreationSettings",
      "GridDefaultElement",
      "GridElementStyleOptions",
      "GridFrame",
      "GridFrameMargins",
      "GridGraph",
      "GridLines",
      "GridLinesStyle",
      "GroebnerBasis",
      "GroupActionBase",
      "GroupBy",
      "GroupCentralizer",
      "GroupElementFromWord",
      "GroupElementPosition",
      "GroupElementQ",
      "GroupElements",
      "GroupElementToWord",
      "GroupGenerators",
      "Groupings",
      "GroupMultiplicationTable",
      "GroupOrbits",
      "GroupOrder",
      "GroupPageBreakWithin",
      "GroupSetwiseStabilizer",
      "GroupStabilizer",
      "GroupStabilizerChain",
      "GroupTogetherGrouping",
      "GroupTogetherNestedGrouping",
      "GrowCutComponents",
      "Gudermannian",
      "GuidedFilter",
      "GumbelDistribution",
      "HaarWavelet",
      "HadamardMatrix",
      "HalfLine",
      "HalfNormalDistribution",
      "HalfPlane",
      "HalfSpace",
      "HalftoneShading",
      "HamiltonianGraphQ",
      "HammingDistance",
      "HammingWindow",
      "HandlerFunctions",
      "HandlerFunctionsKeys",
      "HankelH1",
      "HankelH2",
      "HankelMatrix",
      "HankelTransform",
      "HannPoissonWindow",
      "HannWindow",
      "HaradaNortonGroupHN",
      "HararyGraph",
      "HarmonicMean",
      "HarmonicMeanFilter",
      "HarmonicNumber",
      "Hash",
      "HatchFilling",
      "HatchShading",
      "Haversine",
      "HazardFunction",
      "Head",
      "HeadCompose",
      "HeaderAlignment",
      "HeaderBackground",
      "HeaderDisplayFunction",
      "HeaderLines",
      "HeaderSize",
      "HeaderStyle",
      "Heads",
      "HeavisideLambda",
      "HeavisidePi",
      "HeavisideTheta",
      "HeldGroupHe",
      "HeldPart",
      "HelpBrowserLookup",
      "HelpBrowserNotebook",
      "HelpBrowserSettings",
      "Here",
      "HermiteDecomposition",
      "HermiteH",
      "HermitianMatrixQ",
      "HessenbergDecomposition",
      "Hessian",
      "HeunB",
      "HeunBPrime",
      "HeunC",
      "HeunCPrime",
      "HeunD",
      "HeunDPrime",
      "HeunG",
      "HeunGPrime",
      "HeunT",
      "HeunTPrime",
      "HexadecimalCharacter",
      "Hexahedron",
      "HexahedronBox",
      "HexahedronBoxOptions",
      "HiddenItems",
      "HiddenMarkovProcess",
      "HiddenSurface",
      "Highlighted",
      "HighlightGraph",
      "HighlightImage",
      "HighlightMesh",
      "HighpassFilter",
      "HigmanSimsGroupHS",
      "HilbertCurve",
      "HilbertFilter",
      "HilbertMatrix",
      "Histogram",
      "Histogram3D",
      "HistogramDistribution",
      "HistogramList",
      "HistogramTransform",
      "HistogramTransformInterpolation",
      "HistoricalPeriodData",
      "HitMissTransform",
      "HITSCentrality",
      "HjorthDistribution",
      "HodgeDual",
      "HoeffdingD",
      "HoeffdingDTest",
      "Hold",
      "HoldAll",
      "HoldAllComplete",
      "HoldComplete",
      "HoldFirst",
      "HoldForm",
      "HoldPattern",
      "HoldRest",
      "HolidayCalendar",
      "HomeDirectory",
      "HomePage",
      "Horizontal",
      "HorizontalForm",
      "HorizontalGauge",
      "HorizontalScrollPosition",
      "HornerForm",
      "HostLookup",
      "HotellingTSquareDistribution",
      "HoytDistribution",
      "HTMLSave",
      "HTTPErrorResponse",
      "HTTPRedirect",
      "HTTPRequest",
      "HTTPRequestData",
      "HTTPResponse",
      "Hue",
      "HumanGrowthData",
      "HumpDownHump",
      "HumpEqual",
      "HurwitzLerchPhi",
      "HurwitzZeta",
      "HyperbolicDistribution",
      "HypercubeGraph",
      "HyperexponentialDistribution",
      "Hyperfactorial",
      "Hypergeometric0F1",
      "Hypergeometric0F1Regularized",
      "Hypergeometric1F1",
      "Hypergeometric1F1Regularized",
      "Hypergeometric2F1",
      "Hypergeometric2F1Regularized",
      "HypergeometricDistribution",
      "HypergeometricPFQ",
      "HypergeometricPFQRegularized",
      "HypergeometricU",
      "Hyperlink",
      "HyperlinkAction",
      "HyperlinkCreationSettings",
      "Hyperplane",
      "Hyphenation",
      "HyphenationOptions",
      "HypoexponentialDistribution",
      "HypothesisTestData",
      "I",
      "IconData",
      "Iconize",
      "IconizedObject",
      "IconRules",
      "Icosahedron",
      "Identity",
      "IdentityMatrix",
      "If",
      "IgnoreCase",
      "IgnoreDiacritics",
      "IgnorePunctuation",
      "IgnoreSpellCheck",
      "IgnoringInactive",
      "Im",
      "Image",
      "Image3D",
      "Image3DProjection",
      "Image3DSlices",
      "ImageAccumulate",
      "ImageAdd",
      "ImageAdjust",
      "ImageAlign",
      "ImageApply",
      "ImageApplyIndexed",
      "ImageAspectRatio",
      "ImageAssemble",
      "ImageAugmentationLayer",
      "ImageBoundingBoxes",
      "ImageCache",
      "ImageCacheValid",
      "ImageCapture",
      "ImageCaptureFunction",
      "ImageCases",
      "ImageChannels",
      "ImageClip",
      "ImageCollage",
      "ImageColorSpace",
      "ImageCompose",
      "ImageContainsQ",
      "ImageContents",
      "ImageConvolve",
      "ImageCooccurrence",
      "ImageCorners",
      "ImageCorrelate",
      "ImageCorrespondingPoints",
      "ImageCrop",
      "ImageData",
      "ImageDeconvolve",
      "ImageDemosaic",
      "ImageDifference",
      "ImageDimensions",
      "ImageDisplacements",
      "ImageDistance",
      "ImageEffect",
      "ImageExposureCombine",
      "ImageFeatureTrack",
      "ImageFileApply",
      "ImageFileFilter",
      "ImageFileScan",
      "ImageFilter",
      "ImageFocusCombine",
      "ImageForestingComponents",
      "ImageFormattingWidth",
      "ImageForwardTransformation",
      "ImageGraphics",
      "ImageHistogram",
      "ImageIdentify",
      "ImageInstanceQ",
      "ImageKeypoints",
      "ImageLabels",
      "ImageLegends",
      "ImageLevels",
      "ImageLines",
      "ImageMargins",
      "ImageMarker",
      "ImageMarkers",
      "ImageMeasurements",
      "ImageMesh",
      "ImageMultiply",
      "ImageOffset",
      "ImagePad",
      "ImagePadding",
      "ImagePartition",
      "ImagePeriodogram",
      "ImagePerspectiveTransformation",
      "ImagePosition",
      "ImagePreviewFunction",
      "ImagePyramid",
      "ImagePyramidApply",
      "ImageQ",
      "ImageRangeCache",
      "ImageRecolor",
      "ImageReflect",
      "ImageRegion",
      "ImageResize",
      "ImageResolution",
      "ImageRestyle",
      "ImageRotate",
      "ImageRotated",
      "ImageSaliencyFilter",
      "ImageScaled",
      "ImageScan",
      "ImageSize",
      "ImageSizeAction",
      "ImageSizeCache",
      "ImageSizeMultipliers",
      "ImageSizeRaw",
      "ImageSubtract",
      "ImageTake",
      "ImageTransformation",
      "ImageTrim",
      "ImageType",
      "ImageValue",
      "ImageValuePositions",
      "ImagingDevice",
      "ImplicitRegion",
      "Implies",
      "Import",
      "ImportAutoReplacements",
      "ImportByteArray",
      "ImportOptions",
      "ImportString",
      "ImprovementImportance",
      "In",
      "Inactivate",
      "Inactive",
      "IncidenceGraph",
      "IncidenceList",
      "IncidenceMatrix",
      "IncludeAromaticBonds",
      "IncludeConstantBasis",
      "IncludeDefinitions",
      "IncludeDirectories",
      "IncludeFileExtension",
      "IncludeGeneratorTasks",
      "IncludeHydrogens",
      "IncludeInflections",
      "IncludeMetaInformation",
      "IncludePods",
      "IncludeQuantities",
      "IncludeRelatedTables",
      "IncludeSingularTerm",
      "IncludeWindowTimes",
      "Increment",
      "IndefiniteMatrixQ",
      "Indent",
      "IndentingNewlineSpacings",
      "IndentMaxFraction",
      "IndependenceTest",
      "IndependentEdgeSetQ",
      "IndependentPhysicalQuantity",
      "IndependentUnit",
      "IndependentUnitDimension",
      "IndependentVertexSetQ",
      "Indeterminate",
      "IndeterminateThreshold",
      "IndexCreationOptions",
      "Indexed",
      "IndexEdgeTaggedGraph",
      "IndexGraph",
      "IndexTag",
      "Inequality",
      "InexactNumberQ",
      "InexactNumbers",
      "InfiniteFuture",
      "InfiniteLine",
      "InfinitePast",
      "InfinitePlane",
      "Infinity",
      "Infix",
      "InflationAdjust",
      "InflationMethod",
      "Information",
      "InformationData",
      "InformationDataGrid",
      "Inherited",
      "InheritScope",
      "InhomogeneousPoissonProcess",
      "InitialEvaluationHistory",
      "Initialization",
      "InitializationCell",
      "InitializationCellEvaluation",
      "InitializationCellWarning",
      "InitializationObjects",
      "InitializationValue",
      "Initialize",
      "InitialSeeding",
      "InlineCounterAssignments",
      "InlineCounterIncrements",
      "InlineRules",
      "Inner",
      "InnerPolygon",
      "InnerPolyhedron",
      "Inpaint",
      "Input",
      "InputAliases",
      "InputAssumptions",
      "InputAutoReplacements",
      "InputField",
      "InputFieldBox",
      "InputFieldBoxOptions",
      "InputForm",
      "InputGrouping",
      "InputNamePacket",
      "InputNotebook",
      "InputPacket",
      "InputSettings",
      "InputStream",
      "InputString",
      "InputStringPacket",
      "InputToBoxFormPacket",
      "Insert",
      "InsertionFunction",
      "InsertionPointObject",
      "InsertLinebreaks",
      "InsertResults",
      "Inset",
      "Inset3DBox",
      "Inset3DBoxOptions",
      "InsetBox",
      "InsetBoxOptions",
      "Insphere",
      "Install",
      "InstallService",
      "InstanceNormalizationLayer",
      "InString",
      "Integer",
      "IntegerDigits",
      "IntegerExponent",
      "IntegerLength",
      "IntegerName",
      "IntegerPart",
      "IntegerPartitions",
      "IntegerQ",
      "IntegerReverse",
      "Integers",
      "IntegerString",
      "Integral",
      "Integrate",
      "Interactive",
      "InteractiveTradingChart",
      "Interlaced",
      "Interleaving",
      "InternallyBalancedDecomposition",
      "InterpolatingFunction",
      "InterpolatingPolynomial",
      "Interpolation",
      "InterpolationOrder",
      "InterpolationPoints",
      "InterpolationPrecision",
      "Interpretation",
      "InterpretationBox",
      "InterpretationBoxOptions",
      "InterpretationFunction",
      "Interpreter",
      "InterpretTemplate",
      "InterquartileRange",
      "Interrupt",
      "InterruptSettings",
      "IntersectedEntityClass",
      "IntersectingQ",
      "Intersection",
      "Interval",
      "IntervalIntersection",
      "IntervalMarkers",
      "IntervalMarkersStyle",
      "IntervalMemberQ",
      "IntervalSlider",
      "IntervalUnion",
      "Into",
      "Inverse",
      "InverseBetaRegularized",
      "InverseCDF",
      "InverseChiSquareDistribution",
      "InverseContinuousWaveletTransform",
      "InverseDistanceTransform",
      "InverseEllipticNomeQ",
      "InverseErf",
      "InverseErfc",
      "InverseFourier",
      "InverseFourierCosTransform",
      "InverseFourierSequenceTransform",
      "InverseFourierSinTransform",
      "InverseFourierTransform",
      "InverseFunction",
      "InverseFunctions",
      "InverseGammaDistribution",
      "InverseGammaRegularized",
      "InverseGaussianDistribution",
      "InverseGudermannian",
      "InverseHankelTransform",
      "InverseHaversine",
      "InverseImagePyramid",
      "InverseJacobiCD",
      "InverseJacobiCN",
      "InverseJacobiCS",
      "InverseJacobiDC",
      "InverseJacobiDN",
      "InverseJacobiDS",
      "InverseJacobiNC",
      "InverseJacobiND",
      "InverseJacobiNS",
      "InverseJacobiSC",
      "InverseJacobiSD",
      "InverseJacobiSN",
      "InverseLaplaceTransform",
      "InverseMellinTransform",
      "InversePermutation",
      "InverseRadon",
      "InverseRadonTransform",
      "InverseSeries",
      "InverseShortTimeFourier",
      "InverseSpectrogram",
      "InverseSurvivalFunction",
      "InverseTransformedRegion",
      "InverseWaveletTransform",
      "InverseWeierstrassP",
      "InverseWishartMatrixDistribution",
      "InverseZTransform",
      "Invisible",
      "InvisibleApplication",
      "InvisibleTimes",
      "IPAddress",
      "IrreduciblePolynomialQ",
      "IslandData",
      "IsolatingInterval",
      "IsomorphicGraphQ",
      "IsotopeData",
      "Italic",
      "Item",
      "ItemAspectRatio",
      "ItemBox",
      "ItemBoxOptions",
      "ItemDisplayFunction",
      "ItemSize",
      "ItemStyle",
      "ItoProcess",
      "JaccardDissimilarity",
      "JacobiAmplitude",
      "Jacobian",
      "JacobiCD",
      "JacobiCN",
      "JacobiCS",
      "JacobiDC",
      "JacobiDN",
      "JacobiDS",
      "JacobiNC",
      "JacobiND",
      "JacobiNS",
      "JacobiP",
      "JacobiSC",
      "JacobiSD",
      "JacobiSN",
      "JacobiSymbol",
      "JacobiZeta",
      "JankoGroupJ1",
      "JankoGroupJ2",
      "JankoGroupJ3",
      "JankoGroupJ4",
      "JarqueBeraALMTest",
      "JohnsonDistribution",
      "Join",
      "JoinAcross",
      "Joined",
      "JoinedCurve",
      "JoinedCurveBox",
      "JoinedCurveBoxOptions",
      "JoinForm",
      "JordanDecomposition",
      "JordanModelDecomposition",
      "JulianDate",
      "JuliaSetBoettcher",
      "JuliaSetIterationCount",
      "JuliaSetPlot",
      "JuliaSetPoints",
      "K",
      "KagiChart",
      "KaiserBesselWindow",
      "KaiserWindow",
      "KalmanEstimator",
      "KalmanFilter",
      "KarhunenLoeveDecomposition",
      "KaryTree",
      "KatzCentrality",
      "KCoreComponents",
      "KDistribution",
      "KEdgeConnectedComponents",
      "KEdgeConnectedGraphQ",
      "KeepExistingVersion",
      "KelvinBei",
      "KelvinBer",
      "KelvinKei",
      "KelvinKer",
      "KendallTau",
      "KendallTauTest",
      "KernelExecute",
      "KernelFunction",
      "KernelMixtureDistribution",
      "KernelObject",
      "Kernels",
      "Ket",
      "Key",
      "KeyCollisionFunction",
      "KeyComplement",
      "KeyDrop",
      "KeyDropFrom",
      "KeyExistsQ",
      "KeyFreeQ",
      "KeyIntersection",
      "KeyMap",
      "KeyMemberQ",
      "KeypointStrength",
      "Keys",
      "KeySelect",
      "KeySort",
      "KeySortBy",
      "KeyTake",
      "KeyUnion",
      "KeyValueMap",
      "KeyValuePattern",
      "Khinchin",
      "KillProcess",
      "KirchhoffGraph",
      "KirchhoffMatrix",
      "KleinInvariantJ",
      "KnapsackSolve",
      "KnightTourGraph",
      "KnotData",
      "KnownUnitQ",
      "KochCurve",
      "KolmogorovSmirnovTest",
      "KroneckerDelta",
      "KroneckerModelDecomposition",
      "KroneckerProduct",
      "KroneckerSymbol",
      "KuiperTest",
      "KumaraswamyDistribution",
      "Kurtosis",
      "KuwaharaFilter",
      "KVertexConnectedComponents",
      "KVertexConnectedGraphQ",
      "LABColor",
      "Label",
      "Labeled",
      "LabeledSlider",
      "LabelingFunction",
      "LabelingSize",
      "LabelStyle",
      "LabelVisibility",
      "LaguerreL",
      "LakeData",
      "LambdaComponents",
      "LambertW",
      "LaminaData",
      "LanczosWindow",
      "LandauDistribution",
      "Language",
      "LanguageCategory",
      "LanguageData",
      "LanguageIdentify",
      "LanguageOptions",
      "LaplaceDistribution",
      "LaplaceTransform",
      "Laplacian",
      "LaplacianFilter",
      "LaplacianGaussianFilter",
      "Large",
      "Larger",
      "Last",
      "Latitude",
      "LatitudeLongitude",
      "LatticeData",
      "LatticeReduce",
      "Launch",
      "LaunchKernels",
      "LayeredGraphPlot",
      "LayerSizeFunction",
      "LayoutInformation",
      "LCHColor",
      "LCM",
      "LeaderSize",
      "LeafCount",
      "LeapYearQ",
      "LearnDistribution",
      "LearnedDistribution",
      "LearningRate",
      "LearningRateMultipliers",
      "LeastSquares",
      "LeastSquaresFilterKernel",
      "Left",
      "LeftArrow",
      "LeftArrowBar",
      "LeftArrowRightArrow",
      "LeftDownTeeVector",
      "LeftDownVector",
      "LeftDownVectorBar",
      "LeftRightArrow",
      "LeftRightVector",
      "LeftTee",
      "LeftTeeArrow",
      "LeftTeeVector",
      "LeftTriangle",
      "LeftTriangleBar",
      "LeftTriangleEqual",
      "LeftUpDownVector",
      "LeftUpTeeVector",
      "LeftUpVector",
      "LeftUpVectorBar",
      "LeftVector",
      "LeftVectorBar",
      "LegendAppearance",
      "Legended",
      "LegendFunction",
      "LegendLabel",
      "LegendLayout",
      "LegendMargins",
      "LegendMarkers",
      "LegendMarkerSize",
      "LegendreP",
      "LegendreQ",
      "LegendreType",
      "Length",
      "LengthWhile",
      "LerchPhi",
      "Less",
      "LessEqual",
      "LessEqualGreater",
      "LessEqualThan",
      "LessFullEqual",
      "LessGreater",
      "LessLess",
      "LessSlantEqual",
      "LessThan",
      "LessTilde",
      "LetterCharacter",
      "LetterCounts",
      "LetterNumber",
      "LetterQ",
      "Level",
      "LeveneTest",
      "LeviCivitaTensor",
      "LevyDistribution",
      "Lexicographic",
      "LibraryDataType",
      "LibraryFunction",
      "LibraryFunctionError",
      "LibraryFunctionInformation",
      "LibraryFunctionLoad",
      "LibraryFunctionUnload",
      "LibraryLoad",
      "LibraryUnload",
      "LicenseID",
      "LiftingFilterData",
      "LiftingWaveletTransform",
      "LightBlue",
      "LightBrown",
      "LightCyan",
      "Lighter",
      "LightGray",
      "LightGreen",
      "Lighting",
      "LightingAngle",
      "LightMagenta",
      "LightOrange",
      "LightPink",
      "LightPurple",
      "LightRed",
      "LightSources",
      "LightYellow",
      "Likelihood",
      "Limit",
      "LimitsPositioning",
      "LimitsPositioningTokens",
      "LindleyDistribution",
      "Line",
      "Line3DBox",
      "Line3DBoxOptions",
      "LinearFilter",
      "LinearFractionalOptimization",
      "LinearFractionalTransform",
      "LinearGradientImage",
      "LinearizingTransformationData",
      "LinearLayer",
      "LinearModelFit",
      "LinearOffsetFunction",
      "LinearOptimization",
      "LinearProgramming",
      "LinearRecurrence",
      "LinearSolve",
      "LinearSolveFunction",
      "LineBox",
      "LineBoxOptions",
      "LineBreak",
      "LinebreakAdjustments",
      "LineBreakChart",
      "LinebreakSemicolonWeighting",
      "LineBreakWithin",
      "LineColor",
      "LineGraph",
      "LineIndent",
      "LineIndentMaxFraction",
      "LineIntegralConvolutionPlot",
      "LineIntegralConvolutionScale",
      "LineLegend",
      "LineOpacity",
      "LineSpacing",
      "LineWrapParts",
      "LinkActivate",
      "LinkClose",
      "LinkConnect",
      "LinkConnectedQ",
      "LinkCreate",
      "LinkError",
      "LinkFlush",
      "LinkFunction",
      "LinkHost",
      "LinkInterrupt",
      "LinkLaunch",
      "LinkMode",
      "LinkObject",
      "LinkOpen",
      "LinkOptions",
      "LinkPatterns",
      "LinkProtocol",
      "LinkRankCentrality",
      "LinkRead",
      "LinkReadHeld",
      "LinkReadyQ",
      "Links",
      "LinkService",
      "LinkWrite",
      "LinkWriteHeld",
      "LiouvilleLambda",
      "List",
      "Listable",
      "ListAnimate",
      "ListContourPlot",
      "ListContourPlot3D",
      "ListConvolve",
      "ListCorrelate",
      "ListCurvePathPlot",
      "ListDeconvolve",
      "ListDensityPlot",
      "ListDensityPlot3D",
      "Listen",
      "ListFormat",
      "ListFourierSequenceTransform",
      "ListInterpolation",
      "ListLineIntegralConvolutionPlot",
      "ListLinePlot",
      "ListLogLinearPlot",
      "ListLogLogPlot",
      "ListLogPlot",
      "ListPicker",
      "ListPickerBox",
      "ListPickerBoxBackground",
      "ListPickerBoxOptions",
      "ListPlay",
      "ListPlot",
      "ListPlot3D",
      "ListPointPlot3D",
      "ListPolarPlot",
      "ListQ",
      "ListSliceContourPlot3D",
      "ListSliceDensityPlot3D",
      "ListSliceVectorPlot3D",
      "ListStepPlot",
      "ListStreamDensityPlot",
      "ListStreamPlot",
      "ListSurfacePlot3D",
      "ListVectorDensityPlot",
      "ListVectorPlot",
      "ListVectorPlot3D",
      "ListZTransform",
      "Literal",
      "LiteralSearch",
      "LocalAdaptiveBinarize",
      "LocalCache",
      "LocalClusteringCoefficient",
      "LocalizeDefinitions",
      "LocalizeVariables",
      "LocalObject",
      "LocalObjects",
      "LocalResponseNormalizationLayer",
      "LocalSubmit",
      "LocalSymbol",
      "LocalTime",
      "LocalTimeZone",
      "LocationEquivalenceTest",
      "LocationTest",
      "Locator",
      "LocatorAutoCreate",
      "LocatorBox",
      "LocatorBoxOptions",
      "LocatorCentering",
      "LocatorPane",
      "LocatorPaneBox",
      "LocatorPaneBoxOptions",
      "LocatorRegion",
      "Locked",
      "Log",
      "Log10",
      "Log2",
      "LogBarnesG",
      "LogGamma",
      "LogGammaDistribution",
      "LogicalExpand",
      "LogIntegral",
      "LogisticDistribution",
      "LogisticSigmoid",
      "LogitModelFit",
      "LogLikelihood",
      "LogLinearPlot",
      "LogLogisticDistribution",
      "LogLogPlot",
      "LogMultinormalDistribution",
      "LogNormalDistribution",
      "LogPlot",
      "LogRankTest",
      "LogSeriesDistribution",
      "LongEqual",
      "Longest",
      "LongestCommonSequence",
      "LongestCommonSequencePositions",
      "LongestCommonSubsequence",
      "LongestCommonSubsequencePositions",
      "LongestMatch",
      "LongestOrderedSequence",
      "LongForm",
      "Longitude",
      "LongLeftArrow",
      "LongLeftRightArrow",
      "LongRightArrow",
      "LongShortTermMemoryLayer",
      "Lookup",
      "Loopback",
      "LoopFreeGraphQ",
      "Looping",
      "LossFunction",
      "LowerCaseQ",
      "LowerLeftArrow",
      "LowerRightArrow",
      "LowerTriangularize",
      "LowerTriangularMatrixQ",
      "LowpassFilter",
      "LQEstimatorGains",
      "LQGRegulator",
      "LQOutputRegulatorGains",
      "LQRegulatorGains",
      "LUBackSubstitution",
      "LucasL",
      "LuccioSamiComponents",
      "LUDecomposition",
      "LunarEclipse",
      "LUVColor",
      "LyapunovSolve",
      "LyonsGroupLy",
      "MachineID",
      "MachineName",
      "MachineNumberQ",
      "MachinePrecision",
      "MacintoshSystemPageSetup",
      "Magenta",
      "Magnification",
      "Magnify",
      "MailAddressValidation",
      "MailExecute",
      "MailFolder",
      "MailItem",
      "MailReceiverFunction",
      "MailResponseFunction",
      "MailSearch",
      "MailServerConnect",
      "MailServerConnection",
      "MailSettings",
      "MainSolve",
      "MaintainDynamicCaches",
      "Majority",
      "MakeBoxes",
      "MakeExpression",
      "MakeRules",
      "ManagedLibraryExpressionID",
      "ManagedLibraryExpressionQ",
      "MandelbrotSetBoettcher",
      "MandelbrotSetDistance",
      "MandelbrotSetIterationCount",
      "MandelbrotSetMemberQ",
      "MandelbrotSetPlot",
      "MangoldtLambda",
      "ManhattanDistance",
      "Manipulate",
      "Manipulator",
      "MannedSpaceMissionData",
      "MannWhitneyTest",
      "MantissaExponent",
      "Manual",
      "Map",
      "MapAll",
      "MapAt",
      "MapIndexed",
      "MAProcess",
      "MapThread",
      "MarchenkoPasturDistribution",
      "MarcumQ",
      "MardiaCombinedTest",
      "MardiaKurtosisTest",
      "MardiaSkewnessTest",
      "MarginalDistribution",
      "MarkovProcessProperties",
      "Masking",
      "MatchingDissimilarity",
      "MatchLocalNameQ",
      "MatchLocalNames",
      "MatchQ",
      "Material",
      "MathematicalFunctionData",
      "MathematicaNotation",
      "MathieuC",
      "MathieuCharacteristicA",
      "MathieuCharacteristicB",
      "MathieuCharacteristicExponent",
      "MathieuCPrime",
      "MathieuGroupM11",
      "MathieuGroupM12",
      "MathieuGroupM22",
      "MathieuGroupM23",
      "MathieuGroupM24",
      "MathieuS",
      "MathieuSPrime",
      "MathMLForm",
      "MathMLText",
      "Matrices",
      "MatrixExp",
      "MatrixForm",
      "MatrixFunction",
      "MatrixLog",
      "MatrixNormalDistribution",
      "MatrixPlot",
      "MatrixPower",
      "MatrixPropertyDistribution",
      "MatrixQ",
      "MatrixRank",
      "MatrixTDistribution",
      "Max",
      "MaxBend",
      "MaxCellMeasure",
      "MaxColorDistance",
      "MaxDate",
      "MaxDetect",
      "MaxDuration",
      "MaxExtraBandwidths",
      "MaxExtraConditions",
      "MaxFeatureDisplacement",
      "MaxFeatures",
      "MaxFilter",
      "MaximalBy",
      "Maximize",
      "MaxItems",
      "MaxIterations",
      "MaxLimit",
      "MaxMemoryUsed",
      "MaxMixtureKernels",
      "MaxOverlapFraction",
      "MaxPlotPoints",
      "MaxPoints",
      "MaxRecursion",
      "MaxStableDistribution",
      "MaxStepFraction",
      "MaxSteps",
      "MaxStepSize",
      "MaxTrainingRounds",
      "MaxValue",
      "MaxwellDistribution",
      "MaxWordGap",
      "McLaughlinGroupMcL",
      "Mean",
      "MeanAbsoluteLossLayer",
      "MeanAround",
      "MeanClusteringCoefficient",
      "MeanDegreeConnectivity",
      "MeanDeviation",
      "MeanFilter",
      "MeanGraphDistance",
      "MeanNeighborDegree",
      "MeanShift",
      "MeanShiftFilter",
      "MeanSquaredLossLayer",
      "Median",
      "MedianDeviation",
      "MedianFilter",
      "MedicalTestData",
      "Medium",
      "MeijerG",
      "MeijerGReduce",
      "MeixnerDistribution",
      "MellinConvolve",
      "MellinTransform",
      "MemberQ",
      "MemoryAvailable",
      "MemoryConstrained",
      "MemoryConstraint",
      "MemoryInUse",
      "MengerMesh",
      "Menu",
      "MenuAppearance",
      "MenuCommandKey",
      "MenuEvaluator",
      "MenuItem",
      "MenuList",
      "MenuPacket",
      "MenuSortingValue",
      "MenuStyle",
      "MenuView",
      "Merge",
      "MergeDifferences",
      "MergingFunction",
      "MersennePrimeExponent",
      "MersennePrimeExponentQ",
      "Mesh",
      "MeshCellCentroid",
      "MeshCellCount",
      "MeshCellHighlight",
      "MeshCellIndex",
      "MeshCellLabel",
      "MeshCellMarker",
      "MeshCellMeasure",
      "MeshCellQuality",
      "MeshCells",
      "MeshCellShapeFunction",
      "MeshCellStyle",
      "MeshConnectivityGraph",
      "MeshCoordinates",
      "MeshFunctions",
      "MeshPrimitives",
      "MeshQualityGoal",
      "MeshRange",
      "MeshRefinementFunction",
      "MeshRegion",
      "MeshRegionQ",
      "MeshShading",
      "MeshStyle",
      "Message",
      "MessageDialog",
      "MessageList",
      "MessageName",
      "MessageObject",
      "MessageOptions",
      "MessagePacket",
      "Messages",
      "MessagesNotebook",
      "MetaCharacters",
      "MetaInformation",
      "MeteorShowerData",
      "Method",
      "MethodOptions",
      "MexicanHatWavelet",
      "MeyerWavelet",
      "Midpoint",
      "Min",
      "MinColorDistance",
      "MinDate",
      "MinDetect",
      "MineralData",
      "MinFilter",
      "MinimalBy",
      "MinimalPolynomial",
      "MinimalStateSpaceModel",
      "Minimize",
      "MinimumTimeIncrement",
      "MinIntervalSize",
      "MinkowskiQuestionMark",
      "MinLimit",
      "MinMax",
      "MinorPlanetData",
      "Minors",
      "MinRecursion",
      "MinSize",
      "MinStableDistribution",
      "Minus",
      "MinusPlus",
      "MinValue",
      "Missing",
      "MissingBehavior",
      "MissingDataMethod",
      "MissingDataRules",
      "MissingQ",
      "MissingString",
      "MissingStyle",
      "MissingValuePattern",
      "MittagLefflerE",
      "MixedFractionParts",
      "MixedGraphQ",
      "MixedMagnitude",
      "MixedRadix",
      "MixedRadixQuantity",
      "MixedUnit",
      "MixtureDistribution",
      "Mod",
      "Modal",
      "Mode",
      "Modular",
      "ModularInverse",
      "ModularLambda",
      "Module",
      "Modulus",
      "MoebiusMu",
      "Molecule",
      "MoleculeContainsQ",
      "MoleculeEquivalentQ",
      "MoleculeGraph",
      "MoleculeModify",
      "MoleculePattern",
      "MoleculePlot",
      "MoleculePlot3D",
      "MoleculeProperty",
      "MoleculeQ",
      "MoleculeRecognize",
      "MoleculeValue",
      "Moment",
      "Momentary",
      "MomentConvert",
      "MomentEvaluate",
      "MomentGeneratingFunction",
      "MomentOfInertia",
      "Monday",
      "Monitor",
      "MonomialList",
      "MonomialOrder",
      "MonsterGroupM",
      "MoonPhase",
      "MoonPosition",
      "MorletWavelet",
      "MorphologicalBinarize",
      "MorphologicalBranchPoints",
      "MorphologicalComponents",
      "MorphologicalEulerNumber",
      "MorphologicalGraph",
      "MorphologicalPerimeter",
      "MorphologicalTransform",
      "MortalityData",
      "Most",
      "MountainData",
      "MouseAnnotation",
      "MouseAppearance",
      "MouseAppearanceTag",
      "MouseButtons",
      "Mouseover",
      "MousePointerNote",
      "MousePosition",
      "MovieData",
      "MovingAverage",
      "MovingMap",
      "MovingMedian",
      "MoyalDistribution",
      "Multicolumn",
      "MultiedgeStyle",
      "MultigraphQ",
      "MultilaunchWarning",
      "MultiLetterItalics",
      "MultiLetterStyle",
      "MultilineFunction",
      "Multinomial",
      "MultinomialDistribution",
      "MultinormalDistribution",
      "MultiplicativeOrder",
      "Multiplicity",
      "MultiplySides",
      "Multiselection",
      "MultivariateHypergeometricDistribution",
      "MultivariatePoissonDistribution",
      "MultivariateTDistribution",
      "N",
      "NakagamiDistribution",
      "NameQ",
      "Names",
      "NamespaceBox",
      "NamespaceBoxOptions",
      "Nand",
      "NArgMax",
      "NArgMin",
      "NBernoulliB",
      "NBodySimulation",
      "NBodySimulationData",
      "NCache",
      "NDEigensystem",
      "NDEigenvalues",
      "NDSolve",
      "NDSolveValue",
      "Nearest",
      "NearestFunction",
      "NearestMeshCells",
      "NearestNeighborGraph",
      "NearestTo",
      "NebulaData",
      "NeedCurrentFrontEndPackagePacket",
      "NeedCurrentFrontEndSymbolsPacket",
      "NeedlemanWunschSimilarity",
      "Needs",
      "Negative",
      "NegativeBinomialDistribution",
      "NegativeDefiniteMatrixQ",
      "NegativeIntegers",
      "NegativeMultinomialDistribution",
      "NegativeRationals",
      "NegativeReals",
      "NegativeSemidefiniteMatrixQ",
      "NeighborhoodData",
      "NeighborhoodGraph",
      "Nest",
      "NestedGreaterGreater",
      "NestedLessLess",
      "NestedScriptRules",
      "NestGraph",
      "NestList",
      "NestWhile",
      "NestWhileList",
      "NetAppend",
      "NetBidirectionalOperator",
      "NetChain",
      "NetDecoder",
      "NetDelete",
      "NetDrop",
      "NetEncoder",
      "NetEvaluationMode",
      "NetExtract",
      "NetFlatten",
      "NetFoldOperator",
      "NetGANOperator",
      "NetGraph",
      "NetInformation",
      "NetInitialize",
      "NetInsert",
      "NetInsertSharedArrays",
      "NetJoin",
      "NetMapOperator",
      "NetMapThreadOperator",
      "NetMeasurements",
      "NetModel",
      "NetNestOperator",
      "NetPairEmbeddingOperator",
      "NetPort",
      "NetPortGradient",
      "NetPrepend",
      "NetRename",
      "NetReplace",
      "NetReplacePart",
      "NetSharedArray",
      "NetStateObject",
      "NetTake",
      "NetTrain",
      "NetTrainResultsObject",
      "NetworkPacketCapture",
      "NetworkPacketRecording",
      "NetworkPacketRecordingDuring",
      "NetworkPacketTrace",
      "NeumannValue",
      "NevilleThetaC",
      "NevilleThetaD",
      "NevilleThetaN",
      "NevilleThetaS",
      "NewPrimitiveStyle",
      "NExpectation",
      "Next",
      "NextCell",
      "NextDate",
      "NextPrime",
      "NextScheduledTaskTime",
      "NHoldAll",
      "NHoldFirst",
      "NHoldRest",
      "NicholsGridLines",
      "NicholsPlot",
      "NightHemisphere",
      "NIntegrate",
      "NMaximize",
      "NMaxValue",
      "NMinimize",
      "NMinValue",
      "NominalVariables",
      "NonAssociative",
      "NoncentralBetaDistribution",
      "NoncentralChiSquareDistribution",
      "NoncentralFRatioDistribution",
      "NoncentralStudentTDistribution",
      "NonCommutativeMultiply",
      "NonConstants",
      "NondimensionalizationTransform",
      "None",
      "NoneTrue",
      "NonlinearModelFit",
      "NonlinearStateSpaceModel",
      "NonlocalMeansFilter",
      "NonNegative",
      "NonNegativeIntegers",
      "NonNegativeRationals",
      "NonNegativeReals",
      "NonPositive",
      "NonPositiveIntegers",
      "NonPositiveRationals",
      "NonPositiveReals",
      "Nor",
      "NorlundB",
      "Norm",
      "Normal",
      "NormalDistribution",
      "NormalGrouping",
      "NormalizationLayer",
      "Normalize",
      "Normalized",
      "NormalizedSquaredEuclideanDistance",
      "NormalMatrixQ",
      "NormalsFunction",
      "NormFunction",
      "Not",
      "NotCongruent",
      "NotCupCap",
      "NotDoubleVerticalBar",
      "Notebook",
      "NotebookApply",
      "NotebookAutoSave",
      "NotebookClose",
      "NotebookConvertSettings",
      "NotebookCreate",
      "NotebookCreateReturnObject",
      "NotebookDefault",
      "NotebookDelete",
      "NotebookDirectory",
      "NotebookDynamicExpression",
      "NotebookEvaluate",
      "NotebookEventActions",
      "NotebookFileName",
      "NotebookFind",
      "NotebookFindReturnObject",
      "NotebookGet",
      "NotebookGetLayoutInformationPacket",
      "NotebookGetMisspellingsPacket",
      "NotebookImport",
      "NotebookInformation",
      "NotebookInterfaceObject",
      "NotebookLocate",
      "NotebookObject",
      "NotebookOpen",
      "NotebookOpenReturnObject",
      "NotebookPath",
      "NotebookPrint",
      "NotebookPut",
      "NotebookPutReturnObject",
      "NotebookRead",
      "NotebookResetGeneratedCells",
      "Notebooks",
      "NotebookSave",
      "NotebookSaveAs",
      "NotebookSelection",
      "NotebookSetupLayoutInformationPacket",
      "NotebooksMenu",
      "NotebookTemplate",
      "NotebookWrite",
      "NotElement",
      "NotEqualTilde",
      "NotExists",
      "NotGreater",
      "NotGreaterEqual",
      "NotGreaterFullEqual",
      "NotGreaterGreater",
      "NotGreaterLess",
      "NotGreaterSlantEqual",
      "NotGreaterTilde",
      "Nothing",
      "NotHumpDownHump",
      "NotHumpEqual",
      "NotificationFunction",
      "NotLeftTriangle",
      "NotLeftTriangleBar",
      "NotLeftTriangleEqual",
      "NotLess",
      "NotLessEqual",
      "NotLessFullEqual",
      "NotLessGreater",
      "NotLessLess",
      "NotLessSlantEqual",
      "NotLessTilde",
      "NotNestedGreaterGreater",
      "NotNestedLessLess",
      "NotPrecedes",
      "NotPrecedesEqual",
      "NotPrecedesSlantEqual",
      "NotPrecedesTilde",
      "NotReverseElement",
      "NotRightTriangle",
      "NotRightTriangleBar",
      "NotRightTriangleEqual",
      "NotSquareSubset",
      "NotSquareSubsetEqual",
      "NotSquareSuperset",
      "NotSquareSupersetEqual",
      "NotSubset",
      "NotSubsetEqual",
      "NotSucceeds",
      "NotSucceedsEqual",
      "NotSucceedsSlantEqual",
      "NotSucceedsTilde",
      "NotSuperset",
      "NotSupersetEqual",
      "NotTilde",
      "NotTildeEqual",
      "NotTildeFullEqual",
      "NotTildeTilde",
      "NotVerticalBar",
      "Now",
      "NoWhitespace",
      "NProbability",
      "NProduct",
      "NProductFactors",
      "NRoots",
      "NSolve",
      "NSum",
      "NSumTerms",
      "NuclearExplosionData",
      "NuclearReactorData",
      "Null",
      "NullRecords",
      "NullSpace",
      "NullWords",
      "Number",
      "NumberCompose",
      "NumberDecompose",
      "NumberExpand",
      "NumberFieldClassNumber",
      "NumberFieldDiscriminant",
      "NumberFieldFundamentalUnits",
      "NumberFieldIntegralBasis",
      "NumberFieldNormRepresentatives",
      "NumberFieldRegulator",
      "NumberFieldRootsOfUnity",
      "NumberFieldSignature",
      "NumberForm",
      "NumberFormat",
      "NumberLinePlot",
      "NumberMarks",
      "NumberMultiplier",
      "NumberPadding",
      "NumberPoint",
      "NumberQ",
      "NumberSeparator",
      "NumberSigns",
      "NumberString",
      "Numerator",
      "NumeratorDenominator",
      "NumericalOrder",
      "NumericalSort",
      "NumericArray",
      "NumericArrayQ",
      "NumericArrayType",
      "NumericFunction",
      "NumericQ",
      "NuttallWindow",
      "NValues",
      "NyquistGridLines",
      "NyquistPlot",
      "O",
      "ObservabilityGramian",
      "ObservabilityMatrix",
      "ObservableDecomposition",
      "ObservableModelQ",
      "OceanData",
      "Octahedron",
      "OddQ",
      "Off",
      "Offset",
      "OLEData",
      "On",
      "ONanGroupON",
      "Once",
      "OneIdentity",
      "Opacity",
      "OpacityFunction",
      "OpacityFunctionScaling",
      "Open",
      "OpenAppend",
      "Opener",
      "OpenerBox",
      "OpenerBoxOptions",
      "OpenerView",
      "OpenFunctionInspectorPacket",
      "Opening",
      "OpenRead",
      "OpenSpecialOptions",
      "OpenTemporary",
      "OpenWrite",
      "Operate",
      "OperatingSystem",
      "OperatorApplied",
      "OptimumFlowData",
      "Optional",
      "OptionalElement",
      "OptionInspectorSettings",
      "OptionQ",
      "Options",
      "OptionsPacket",
      "OptionsPattern",
      "OptionValue",
      "OptionValueBox",
      "OptionValueBoxOptions",
      "Or",
      "Orange",
      "Order",
      "OrderDistribution",
      "OrderedQ",
      "Ordering",
      "OrderingBy",
      "OrderingLayer",
      "Orderless",
      "OrderlessPatternSequence",
      "OrnsteinUhlenbeckProcess",
      "Orthogonalize",
      "OrthogonalMatrixQ",
      "Out",
      "Outer",
      "OuterPolygon",
      "OuterPolyhedron",
      "OutputAutoOverwrite",
      "OutputControllabilityMatrix",
      "OutputControllableModelQ",
      "OutputForm",
      "OutputFormData",
      "OutputGrouping",
      "OutputMathEditExpression",
      "OutputNamePacket",
      "OutputResponse",
      "OutputSizeLimit",
      "OutputStream",
      "Over",
      "OverBar",
      "OverDot",
      "Overflow",
      "OverHat",
      "Overlaps",
      "Overlay",
      "OverlayBox",
      "OverlayBoxOptions",
      "Overscript",
      "OverscriptBox",
      "OverscriptBoxOptions",
      "OverTilde",
      "OverVector",
      "OverwriteTarget",
      "OwenT",
      "OwnValues",
      "Package",
      "PackingMethod",
      "PackPaclet",
      "PacletDataRebuild",
      "PacletDirectoryAdd",
      "PacletDirectoryLoad",
      "PacletDirectoryRemove",
      "PacletDirectoryUnload",
      "PacletDisable",
      "PacletEnable",
      "PacletFind",
      "PacletFindRemote",
      "PacletInformation",
      "PacletInstall",
      "PacletInstallSubmit",
      "PacletNewerQ",
      "PacletObject",
      "PacletObjectQ",
      "PacletSite",
      "PacletSiteObject",
      "PacletSiteRegister",
      "PacletSites",
      "PacletSiteUnregister",
      "PacletSiteUpdate",
      "PacletUninstall",
      "PacletUpdate",
      "PaddedForm",
      "Padding",
      "PaddingLayer",
      "PaddingSize",
      "PadeApproximant",
      "PadLeft",
      "PadRight",
      "PageBreakAbove",
      "PageBreakBelow",
      "PageBreakWithin",
      "PageFooterLines",
      "PageFooters",
      "PageHeaderLines",
      "PageHeaders",
      "PageHeight",
      "PageRankCentrality",
      "PageTheme",
      "PageWidth",
      "Pagination",
      "PairedBarChart",
      "PairedHistogram",
      "PairedSmoothHistogram",
      "PairedTTest",
      "PairedZTest",
      "PaletteNotebook",
      "PalettePath",
      "PalindromeQ",
      "Pane",
      "PaneBox",
      "PaneBoxOptions",
      "Panel",
      "PanelBox",
      "PanelBoxOptions",
      "Paneled",
      "PaneSelector",
      "PaneSelectorBox",
      "PaneSelectorBoxOptions",
      "PaperWidth",
      "ParabolicCylinderD",
      "ParagraphIndent",
      "ParagraphSpacing",
      "ParallelArray",
      "ParallelCombine",
      "ParallelDo",
      "Parallelepiped",
      "ParallelEvaluate",
      "Parallelization",
      "Parallelize",
      "ParallelMap",
      "ParallelNeeds",
      "Parallelogram",
      "ParallelProduct",
      "ParallelSubmit",
      "ParallelSum",
      "ParallelTable",
      "ParallelTry",
      "Parameter",
      "ParameterEstimator",
      "ParameterMixtureDistribution",
      "ParameterVariables",
      "ParametricFunction",
      "ParametricNDSolve",
      "ParametricNDSolveValue",
      "ParametricPlot",
      "ParametricPlot3D",
      "ParametricRampLayer",
      "ParametricRegion",
      "ParentBox",
      "ParentCell",
      "ParentConnect",
      "ParentDirectory",
      "ParentForm",
      "Parenthesize",
      "ParentList",
      "ParentNotebook",
      "ParetoDistribution",
      "ParetoPickandsDistribution",
      "ParkData",
      "Part",
      "PartBehavior",
      "PartialCorrelationFunction",
      "PartialD",
      "ParticleAcceleratorData",
      "ParticleData",
      "Partition",
      "PartitionGranularity",
      "PartitionsP",
      "PartitionsQ",
      "PartLayer",
      "PartOfSpeech",
      "PartProtection",
      "ParzenWindow",
      "PascalDistribution",
      "PassEventsDown",
      "PassEventsUp",
      "Paste",
      "PasteAutoQuoteCharacters",
      "PasteBoxFormInlineCells",
      "PasteButton",
      "Path",
      "PathGraph",
      "PathGraphQ",
      "Pattern",
      "PatternFilling",
      "PatternSequence",
      "PatternTest",
      "PauliMatrix",
      "PaulWavelet",
      "Pause",
      "PausedTime",
      "PDF",
      "PeakDetect",
      "PeanoCurve",
      "PearsonChiSquareTest",
      "PearsonCorrelationTest",
      "PearsonDistribution",
      "PercentForm",
      "PerfectNumber",
      "PerfectNumberQ",
      "PerformanceGoal",
      "Perimeter",
      "PeriodicBoundaryCondition",
      "PeriodicInterpolation",
      "Periodogram",
      "PeriodogramArray",
      "Permanent",
      "Permissions",
      "PermissionsGroup",
      "PermissionsGroupMemberQ",
      "PermissionsGroups",
      "PermissionsKey",
      "PermissionsKeys",
      "PermutationCycles",
      "PermutationCyclesQ",
      "PermutationGroup",
      "PermutationLength",
      "PermutationList",
      "PermutationListQ",
      "PermutationMax",
      "PermutationMin",
      "PermutationOrder",
      "PermutationPower",
      "PermutationProduct",
      "PermutationReplace",
      "Permutations",
      "PermutationSupport",
      "Permute",
      "PeronaMalikFilter",
      "Perpendicular",
      "PerpendicularBisector",
      "PersistenceLocation",
      "PersistenceTime",
      "PersistentObject",
      "PersistentObjects",
      "PersistentValue",
      "PersonData",
      "PERTDistribution",
      "PetersenGraph",
      "PhaseMargins",
      "PhaseRange",
      "PhysicalSystemData",
      "Pi",
      "Pick",
      "PIDData",
      "PIDDerivativeFilter",
      "PIDFeedforward",
      "PIDTune",
      "Piecewise",
      "PiecewiseExpand",
      "PieChart",
      "PieChart3D",
      "PillaiTrace",
      "PillaiTraceTest",
      "PingTime",
      "Pink",
      "PitchRecognize",
      "Pivoting",
      "PixelConstrained",
      "PixelValue",
      "PixelValuePositions",
      "Placed",
      "Placeholder",
      "PlaceholderReplace",
      "Plain",
      "PlanarAngle",
      "PlanarGraph",
      "PlanarGraphQ",
      "PlanckRadiationLaw",
      "PlaneCurveData",
      "PlanetaryMoonData",
      "PlanetData",
      "PlantData",
      "Play",
      "PlayRange",
      "Plot",
      "Plot3D",
      "Plot3Matrix",
      "PlotDivision",
      "PlotJoined",
      "PlotLabel",
      "PlotLabels",
      "PlotLayout",
      "PlotLegends",
      "PlotMarkers",
      "PlotPoints",
      "PlotRange",
      "PlotRangeClipping",
      "PlotRangeClipPlanesStyle",
      "PlotRangePadding",
      "PlotRegion",
      "PlotStyle",
      "PlotTheme",
      "Pluralize",
      "Plus",
      "PlusMinus",
      "Pochhammer",
      "PodStates",
      "PodWidth",
      "Point",
      "Point3DBox",
      "Point3DBoxOptions",
      "PointBox",
      "PointBoxOptions",
      "PointFigureChart",
      "PointLegend",
      "PointSize",
      "PoissonConsulDistribution",
      "PoissonDistribution",
      "PoissonProcess",
      "PoissonWindow",
      "PolarAxes",
      "PolarAxesOrigin",
      "PolarGridLines",
      "PolarPlot",
      "PolarTicks",
      "PoleZeroMarkers",
      "PolyaAeppliDistribution",
      "PolyGamma",
      "Polygon",
      "Polygon3DBox",
      "Polygon3DBoxOptions",
      "PolygonalNumber",
      "PolygonAngle",
      "PolygonBox",
      "PolygonBoxOptions",
      "PolygonCoordinates",
      "PolygonDecomposition",
      "PolygonHoleScale",
      "PolygonIntersections",
      "PolygonScale",
      "Polyhedron",
      "PolyhedronAngle",
      "PolyhedronCoordinates",
      "PolyhedronData",
      "PolyhedronDecomposition",
      "PolyhedronGenus",
      "PolyLog",
      "PolynomialExtendedGCD",
      "PolynomialForm",
      "PolynomialGCD",
      "PolynomialLCM",
      "PolynomialMod",
      "PolynomialQ",
      "PolynomialQuotient",
      "PolynomialQuotientRemainder",
      "PolynomialReduce",
      "PolynomialRemainder",
      "Polynomials",
      "PoolingLayer",
      "PopupMenu",
      "PopupMenuBox",
      "PopupMenuBoxOptions",
      "PopupView",
      "PopupWindow",
      "Position",
      "PositionIndex",
      "Positive",
      "PositiveDefiniteMatrixQ",
      "PositiveIntegers",
      "PositiveRationals",
      "PositiveReals",
      "PositiveSemidefiniteMatrixQ",
      "PossibleZeroQ",
      "Postfix",
      "PostScript",
      "Power",
      "PowerDistribution",
      "PowerExpand",
      "PowerMod",
      "PowerModList",
      "PowerRange",
      "PowerSpectralDensity",
      "PowersRepresentations",
      "PowerSymmetricPolynomial",
      "Precedence",
      "PrecedenceForm",
      "Precedes",
      "PrecedesEqual",
      "PrecedesSlantEqual",
      "PrecedesTilde",
      "Precision",
      "PrecisionGoal",
      "PreDecrement",
      "Predict",
      "PredictionRoot",
      "PredictorFunction",
      "PredictorInformation",
      "PredictorMeasurements",
      "PredictorMeasurementsObject",
      "PreemptProtect",
      "PreferencesPath",
      "Prefix",
      "PreIncrement",
      "Prepend",
      "PrependLayer",
      "PrependTo",
      "PreprocessingRules",
      "PreserveColor",
      "PreserveImageOptions",
      "Previous",
      "PreviousCell",
      "PreviousDate",
      "PriceGraphDistribution",
      "PrimaryPlaceholder",
      "Prime",
      "PrimeNu",
      "PrimeOmega",
      "PrimePi",
      "PrimePowerQ",
      "PrimeQ",
      "Primes",
      "PrimeZetaP",
      "PrimitivePolynomialQ",
      "PrimitiveRoot",
      "PrimitiveRootList",
      "PrincipalComponents",
      "PrincipalValue",
      "Print",
      "PrintableASCIIQ",
      "PrintAction",
      "PrintForm",
      "PrintingCopies",
      "PrintingOptions",
      "PrintingPageRange",
      "PrintingStartingPageNumber",
      "PrintingStyleEnvironment",
      "Printout3D",
      "Printout3DPreviewer",
      "PrintPrecision",
      "PrintTemporary",
      "Prism",
      "PrismBox",
      "PrismBoxOptions",
      "PrivateCellOptions",
      "PrivateEvaluationOptions",
      "PrivateFontOptions",
      "PrivateFrontEndOptions",
      "PrivateKey",
      "PrivateNotebookOptions",
      "PrivatePaths",
      "Probability",
      "ProbabilityDistribution",
      "ProbabilityPlot",
      "ProbabilityPr",
      "ProbabilityScalePlot",
      "ProbitModelFit",
      "ProcessConnection",
      "ProcessDirectory",
      "ProcessEnvironment",
      "Processes",
      "ProcessEstimator",
      "ProcessInformation",
      "ProcessObject",
      "ProcessParameterAssumptions",
      "ProcessParameterQ",
      "ProcessStateDomain",
      "ProcessStatus",
      "ProcessTimeDomain",
      "Product",
      "ProductDistribution",
      "ProductLog",
      "ProgressIndicator",
      "ProgressIndicatorBox",
      "ProgressIndicatorBoxOptions",
      "Projection",
      "Prolog",
      "PromptForm",
      "ProofObject",
      "Properties",
      "Property",
      "PropertyList",
      "PropertyValue",
      "Proportion",
      "Proportional",
      "Protect",
      "Protected",
      "ProteinData",
      "Pruning",
      "PseudoInverse",
      "PsychrometricPropertyData",
      "PublicKey",
      "PublisherID",
      "PulsarData",
      "PunctuationCharacter",
      "Purple",
      "Put",
      "PutAppend",
      "Pyramid",
      "PyramidBox",
      "PyramidBoxOptions",
      "QBinomial",
      "QFactorial",
      "QGamma",
      "QHypergeometricPFQ",
      "QnDispersion",
      "QPochhammer",
      "QPolyGamma",
      "QRDecomposition",
      "QuadraticIrrationalQ",
      "QuadraticOptimization",
      "Quantile",
      "QuantilePlot",
      "Quantity",
      "QuantityArray",
      "QuantityDistribution",
      "QuantityForm",
      "QuantityMagnitude",
      "QuantityQ",
      "QuantityUnit",
      "QuantityVariable",
      "QuantityVariableCanonicalUnit",
      "QuantityVariableDimensions",
      "QuantityVariableIdentifier",
      "QuantityVariablePhysicalQuantity",
      "Quartics",
      "QuartileDeviation",
      "Quartiles",
      "QuartileSkewness",
      "Query",
      "QueueingNetworkProcess",
      "QueueingProcess",
      "QueueProperties",
      "Quiet",
      "Quit",
      "Quotient",
      "QuotientRemainder",
      "RadialGradientImage",
      "RadialityCentrality",
      "RadicalBox",
      "RadicalBoxOptions",
      "RadioButton",
      "RadioButtonBar",
      "RadioButtonBox",
      "RadioButtonBoxOptions",
      "Radon",
      "RadonTransform",
      "RamanujanTau",
      "RamanujanTauL",
      "RamanujanTauTheta",
      "RamanujanTauZ",
      "Ramp",
      "Random",
      "RandomChoice",
      "RandomColor",
      "RandomComplex",
      "RandomEntity",
      "RandomFunction",
      "RandomGeoPosition",
      "RandomGraph",
      "RandomImage",
      "RandomInstance",
      "RandomInteger",
      "RandomPermutation",
      "RandomPoint",
      "RandomPolygon",
      "RandomPolyhedron",
      "RandomPrime",
      "RandomReal",
      "RandomSample",
      "RandomSeed",
      "RandomSeeding",
      "RandomVariate",
      "RandomWalkProcess",
      "RandomWord",
      "Range",
      "RangeFilter",
      "RangeSpecification",
      "RankedMax",
      "RankedMin",
      "RarerProbability",
      "Raster",
      "Raster3D",
      "Raster3DBox",
      "Raster3DBoxOptions",
      "RasterArray",
      "RasterBox",
      "RasterBoxOptions",
      "Rasterize",
      "RasterSize",
      "Rational",
      "RationalFunctions",
      "Rationalize",
      "Rationals",
      "Ratios",
      "RawArray",
      "RawBoxes",
      "RawData",
      "RawMedium",
      "RayleighDistribution",
      "Re",
      "Read",
      "ReadByteArray",
      "ReadLine",
      "ReadList",
      "ReadProtected",
      "ReadString",
      "Real",
      "RealAbs",
      "RealBlockDiagonalForm",
      "RealDigits",
      "RealExponent",
      "Reals",
      "RealSign",
      "Reap",
      "RebuildPacletData",
      "RecognitionPrior",
      "RecognitionThreshold",
      "Record",
      "RecordLists",
      "RecordSeparators",
      "Rectangle",
      "RectangleBox",
      "RectangleBoxOptions",
      "RectangleChart",
      "RectangleChart3D",
      "RectangularRepeatingElement",
      "RecurrenceFilter",
      "RecurrenceTable",
      "RecurringDigitsForm",
      "Red",
      "Reduce",
      "RefBox",
      "ReferenceLineStyle",
      "ReferenceMarkers",
      "ReferenceMarkerStyle",
      "Refine",
      "ReflectionMatrix",
      "ReflectionTransform",
      "Refresh",
      "RefreshRate",
      "Region",
      "RegionBinarize",
      "RegionBoundary",
      "RegionBoundaryStyle",
      "RegionBounds",
      "RegionCentroid",
      "RegionDifference",
      "RegionDimension",
      "RegionDisjoint",
      "RegionDistance",
      "RegionDistanceFunction",
      "RegionEmbeddingDimension",
      "RegionEqual",
      "RegionFillingStyle",
      "RegionFunction",
      "RegionImage",
      "RegionIntersection",
      "RegionMeasure",
      "RegionMember",
      "RegionMemberFunction",
      "RegionMoment",
      "RegionNearest",
      "RegionNearestFunction",
      "RegionPlot",
      "RegionPlot3D",
      "RegionProduct",
      "RegionQ",
      "RegionResize",
      "RegionSize",
      "RegionSymmetricDifference",
      "RegionUnion",
      "RegionWithin",
      "RegisterExternalEvaluator",
      "RegularExpression",
      "Regularization",
      "RegularlySampledQ",
      "RegularPolygon",
      "ReIm",
      "ReImLabels",
      "ReImPlot",
      "ReImStyle",
      "Reinstall",
      "RelationalDatabase",
      "RelationGraph",
      "Release",
      "ReleaseHold",
      "ReliabilityDistribution",
      "ReliefImage",
      "ReliefPlot",
      "RemoteAuthorizationCaching",
      "RemoteConnect",
      "RemoteConnectionObject",
      "RemoteFile",
      "RemoteRun",
      "RemoteRunProcess",
      "Remove",
      "RemoveAlphaChannel",
      "RemoveAsynchronousTask",
      "RemoveAudioStream",
      "RemoveBackground",
      "RemoveChannelListener",
      "RemoveChannelSubscribers",
      "Removed",
      "RemoveDiacritics",
      "RemoveInputStreamMethod",
      "RemoveOutputStreamMethod",
      "RemoveProperty",
      "RemoveScheduledTask",
      "RemoveUsers",
      "RemoveVideoStream",
      "RenameDirectory",
      "RenameFile",
      "RenderAll",
      "RenderingOptions",
      "RenewalProcess",
      "RenkoChart",
      "RepairMesh",
      "Repeated",
      "RepeatedNull",
      "RepeatedString",
      "RepeatedTiming",
      "RepeatingElement",
      "Replace",
      "ReplaceAll",
      "ReplaceHeldPart",
      "ReplaceImageValue",
      "ReplaceList",
      "ReplacePart",
      "ReplacePixelValue",
      "ReplaceRepeated",
      "ReplicateLayer",
      "RequiredPhysicalQuantities",
      "Resampling",
      "ResamplingAlgorithmData",
      "ResamplingMethod",
      "Rescale",
      "RescalingTransform",
      "ResetDirectory",
      "ResetMenusPacket",
      "ResetScheduledTask",
      "ReshapeLayer",
      "Residue",
      "ResizeLayer",
      "Resolve",
      "ResourceAcquire",
      "ResourceData",
      "ResourceFunction",
      "ResourceObject",
      "ResourceRegister",
      "ResourceRemove",
      "ResourceSearch",
      "ResourceSubmissionObject",
      "ResourceSubmit",
      "ResourceSystemBase",
      "ResourceSystemPath",
      "ResourceUpdate",
      "ResourceVersion",
      "ResponseForm",
      "Rest",
      "RestartInterval",
      "Restricted",
      "Resultant",
      "ResumePacket",
      "Return",
      "ReturnEntersInput",
      "ReturnExpressionPacket",
      "ReturnInputFormPacket",
      "ReturnPacket",
      "ReturnReceiptFunction",
      "ReturnTextPacket",
      "Reverse",
      "ReverseApplied",
      "ReverseBiorthogonalSplineWavelet",
      "ReverseElement",
      "ReverseEquilibrium",
      "ReverseGraph",
      "ReverseSort",
      "ReverseSortBy",
      "ReverseUpEquilibrium",
      "RevolutionAxis",
      "RevolutionPlot3D",
      "RGBColor",
      "RiccatiSolve",
      "RiceDistribution",
      "RidgeFilter",
      "RiemannR",
      "RiemannSiegelTheta",
      "RiemannSiegelZ",
      "RiemannXi",
      "Riffle",
      "Right",
      "RightArrow",
      "RightArrowBar",
      "RightArrowLeftArrow",
      "RightComposition",
      "RightCosetRepresentative",
      "RightDownTeeVector",
      "RightDownVector",
      "RightDownVectorBar",
      "RightTee",
      "RightTeeArrow",
      "RightTeeVector",
      "RightTriangle",
      "RightTriangleBar",
      "RightTriangleEqual",
      "RightUpDownVector",
      "RightUpTeeVector",
      "RightUpVector",
      "RightUpVectorBar",
      "RightVector",
      "RightVectorBar",
      "RiskAchievementImportance",
      "RiskReductionImportance",
      "RogersTanimotoDissimilarity",
      "RollPitchYawAngles",
      "RollPitchYawMatrix",
      "RomanNumeral",
      "Root",
      "RootApproximant",
      "RootIntervals",
      "RootLocusPlot",
      "RootMeanSquare",
      "RootOfUnityQ",
      "RootReduce",
      "Roots",
      "RootSum",
      "Rotate",
      "RotateLabel",
      "RotateLeft",
      "RotateRight",
      "RotationAction",
      "RotationBox",
      "RotationBoxOptions",
      "RotationMatrix",
      "RotationTransform",
      "Round",
      "RoundImplies",
      "RoundingRadius",
      "Row",
      "RowAlignments",
      "RowBackgrounds",
      "RowBox",
      "RowHeights",
      "RowLines",
      "RowMinHeight",
      "RowReduce",
      "RowsEqual",
      "RowSpacings",
      "RSolve",
      "RSolveValue",
      "RudinShapiro",
      "RudvalisGroupRu",
      "Rule",
      "RuleCondition",
      "RuleDelayed",
      "RuleForm",
      "RulePlot",
      "RulerUnits",
      "Run",
      "RunProcess",
      "RunScheduledTask",
      "RunThrough",
      "RuntimeAttributes",
      "RuntimeOptions",
      "RussellRaoDissimilarity",
      "SameQ",
      "SameTest",
      "SameTestProperties",
      "SampledEntityClass",
      "SampleDepth",
      "SampledSoundFunction",
      "SampledSoundList",
      "SampleRate",
      "SamplingPeriod",
      "SARIMAProcess",
      "SARMAProcess",
      "SASTriangle",
      "SatelliteData",
      "SatisfiabilityCount",
      "SatisfiabilityInstances",
      "SatisfiableQ",
      "Saturday",
      "Save",
      "Saveable",
      "SaveAutoDelete",
      "SaveConnection",
      "SaveDefinitions",
      "SavitzkyGolayMatrix",
      "SawtoothWave",
      "Scale",
      "Scaled",
      "ScaleDivisions",
      "ScaledMousePosition",
      "ScaleOrigin",
      "ScalePadding",
      "ScaleRanges",
      "ScaleRangeStyle",
      "ScalingFunctions",
      "ScalingMatrix",
      "ScalingTransform",
      "Scan",
      "ScheduledTask",
      "ScheduledTaskActiveQ",
      "ScheduledTaskInformation",
      "ScheduledTaskInformationData",
      "ScheduledTaskObject",
      "ScheduledTasks",
      "SchurDecomposition",
      "ScientificForm",
      "ScientificNotationThreshold",
      "ScorerGi",
      "ScorerGiPrime",
      "ScorerHi",
      "ScorerHiPrime",
      "ScreenRectangle",
      "ScreenStyleEnvironment",
      "ScriptBaselineShifts",
      "ScriptForm",
      "ScriptLevel",
      "ScriptMinSize",
      "ScriptRules",
      "ScriptSizeMultipliers",
      "Scrollbars",
      "ScrollingOptions",
      "ScrollPosition",
      "SearchAdjustment",
      "SearchIndexObject",
      "SearchIndices",
      "SearchQueryString",
      "SearchResultObject",
      "Sec",
      "Sech",
      "SechDistribution",
      "SecondOrderConeOptimization",
      "SectionGrouping",
      "SectorChart",
      "SectorChart3D",
      "SectorOrigin",
      "SectorSpacing",
      "SecuredAuthenticationKey",
      "SecuredAuthenticationKeys",
      "SeedRandom",
      "Select",
      "Selectable",
      "SelectComponents",
      "SelectedCells",
      "SelectedNotebook",
      "SelectFirst",
      "Selection",
      "SelectionAnimate",
      "SelectionCell",
      "SelectionCellCreateCell",
      "SelectionCellDefaultStyle",
      "SelectionCellParentStyle",
      "SelectionCreateCell",
      "SelectionDebuggerTag",
      "SelectionDuplicateCell",
      "SelectionEvaluate",
      "SelectionEvaluateCreateCell",
      "SelectionMove",
      "SelectionPlaceholder",
      "SelectionSetStyle",
      "SelectWithContents",
      "SelfLoops",
      "SelfLoopStyle",
      "SemanticImport",
      "SemanticImportString",
      "SemanticInterpretation",
      "SemialgebraicComponentInstances",
      "SemidefiniteOptimization",
      "SendMail",
      "SendMessage",
      "Sequence",
      "SequenceAlignment",
      "SequenceAttentionLayer",
      "SequenceCases",
      "SequenceCount",
      "SequenceFold",
      "SequenceFoldList",
      "SequenceForm",
      "SequenceHold",
      "SequenceLastLayer",
      "SequenceMostLayer",
      "SequencePosition",
      "SequencePredict",
      "SequencePredictorFunction",
      "SequenceReplace",
      "SequenceRestLayer",
      "SequenceReverseLayer",
      "SequenceSplit",
      "Series",
      "SeriesCoefficient",
      "SeriesData",
      "SeriesTermGoal",
      "ServiceConnect",
      "ServiceDisconnect",
      "ServiceExecute",
      "ServiceObject",
      "ServiceRequest",
      "ServiceResponse",
      "ServiceSubmit",
      "SessionSubmit",
      "SessionTime",
      "Set",
      "SetAccuracy",
      "SetAlphaChannel",
      "SetAttributes",
      "Setbacks",
      "SetBoxFormNamesPacket",
      "SetCloudDirectory",
      "SetCookies",
      "SetDelayed",
      "SetDirectory",
      "SetEnvironment",
      "SetEvaluationNotebook",
      "SetFileDate",
      "SetFileLoadingContext",
      "SetNotebookStatusLine",
      "SetOptions",
      "SetOptionsPacket",
      "SetPermissions",
      "SetPrecision",
      "SetProperty",
      "SetSecuredAuthenticationKey",
      "SetSelectedNotebook",
      "SetSharedFunction",
      "SetSharedVariable",
      "SetSpeechParametersPacket",
      "SetStreamPosition",
      "SetSystemModel",
      "SetSystemOptions",
      "Setter",
      "SetterBar",
      "SetterBox",
      "SetterBoxOptions",
      "Setting",
      "SetUsers",
      "SetValue",
      "Shading",
      "Shallow",
      "ShannonWavelet",
      "ShapiroWilkTest",
      "Share",
      "SharingList",
      "Sharpen",
      "ShearingMatrix",
      "ShearingTransform",
      "ShellRegion",
      "ShenCastanMatrix",
      "ShiftedGompertzDistribution",
      "ShiftRegisterSequence",
      "Short",
      "ShortDownArrow",
      "Shortest",
      "ShortestMatch",
      "ShortestPathFunction",
      "ShortLeftArrow",
      "ShortRightArrow",
      "ShortTimeFourier",
      "ShortTimeFourierData",
      "ShortUpArrow",
      "Show",
      "ShowAutoConvert",
      "ShowAutoSpellCheck",
      "ShowAutoStyles",
      "ShowCellBracket",
      "ShowCellLabel",
      "ShowCellTags",
      "ShowClosedCellArea",
      "ShowCodeAssist",
      "ShowContents",
      "ShowControls",
      "ShowCursorTracker",
      "ShowGroupOpenCloseIcon",
      "ShowGroupOpener",
      "ShowInvisibleCharacters",
      "ShowPageBreaks",
      "ShowPredictiveInterface",
      "ShowSelection",
      "ShowShortBoxForm",
      "ShowSpecialCharacters",
      "ShowStringCharacters",
      "ShowSyntaxStyles",
      "ShrinkingDelay",
      "ShrinkWrapBoundingBox",
      "SiderealTime",
      "SiegelTheta",
      "SiegelTukeyTest",
      "SierpinskiCurve",
      "SierpinskiMesh",
      "Sign",
      "Signature",
      "SignedRankTest",
      "SignedRegionDistance",
      "SignificanceLevel",
      "SignPadding",
      "SignTest",
      "SimilarityRules",
      "SimpleGraph",
      "SimpleGraphQ",
      "SimplePolygonQ",
      "SimplePolyhedronQ",
      "Simplex",
      "Simplify",
      "Sin",
      "Sinc",
      "SinghMaddalaDistribution",
      "SingleEvaluation",
      "SingleLetterItalics",
      "SingleLetterStyle",
      "SingularValueDecomposition",
      "SingularValueList",
      "SingularValuePlot",
      "SingularValues",
      "Sinh",
      "SinhIntegral",
      "SinIntegral",
      "SixJSymbol",
      "Skeleton",
      "SkeletonTransform",
      "SkellamDistribution",
      "Skewness",
      "SkewNormalDistribution",
      "SkinStyle",
      "Skip",
      "SliceContourPlot3D",
      "SliceDensityPlot3D",
      "SliceDistribution",
      "SliceVectorPlot3D",
      "Slider",
      "Slider2D",
      "Slider2DBox",
      "Slider2DBoxOptions",
      "SliderBox",
      "SliderBoxOptions",
      "SlideView",
      "Slot",
      "SlotSequence",
      "Small",
      "SmallCircle",
      "Smaller",
      "SmithDecomposition",
      "SmithDelayCompensator",
      "SmithWatermanSimilarity",
      "SmoothDensityHistogram",
      "SmoothHistogram",
      "SmoothHistogram3D",
      "SmoothKernelDistribution",
      "SnDispersion",
      "Snippet",
      "SnubPolyhedron",
      "SocialMediaData",
      "Socket",
      "SocketConnect",
      "SocketListen",
      "SocketListener",
      "SocketObject",
      "SocketOpen",
      "SocketReadMessage",
      "SocketReadyQ",
      "Sockets",
      "SocketWaitAll",
      "SocketWaitNext",
      "SoftmaxLayer",
      "SokalSneathDissimilarity",
      "SolarEclipse",
      "SolarSystemFeatureData",
      "SolidAngle",
      "SolidData",
      "SolidRegionQ",
      "Solve",
      "SolveAlways",
      "SolveDelayed",
      "Sort",
      "SortBy",
      "SortedBy",
      "SortedEntityClass",
      "Sound",
      "SoundAndGraphics",
      "SoundNote",
      "SoundVolume",
      "SourceLink",
      "Sow",
      "Space",
      "SpaceCurveData",
      "SpaceForm",
      "Spacer",
      "Spacings",
      "Span",
      "SpanAdjustments",
      "SpanCharacterRounding",
      "SpanFromAbove",
      "SpanFromBoth",
      "SpanFromLeft",
      "SpanLineThickness",
      "SpanMaxSize",
      "SpanMinSize",
      "SpanningCharacters",
      "SpanSymmetric",
      "SparseArray",
      "SpatialGraphDistribution",
      "SpatialMedian",
      "SpatialTransformationLayer",
      "Speak",
      "SpeakerMatchQ",
      "SpeakTextPacket",
      "SpearmanRankTest",
      "SpearmanRho",
      "SpeciesData",
      "SpecificityGoal",
      "SpectralLineData",
      "Spectrogram",
      "SpectrogramArray",
      "Specularity",
      "SpeechCases",
      "SpeechInterpreter",
      "SpeechRecognize",
      "SpeechSynthesize",
      "SpellingCorrection",
      "SpellingCorrectionList",
      "SpellingDictionaries",
      "SpellingDictionariesPath",
      "SpellingOptions",
      "SpellingSuggestionsPacket",
      "Sphere",
      "SphereBox",
      "SpherePoints",
      "SphericalBesselJ",
      "SphericalBesselY",
      "SphericalHankelH1",
      "SphericalHankelH2",
      "SphericalHarmonicY",
      "SphericalPlot3D",
      "SphericalRegion",
      "SphericalShell",
      "SpheroidalEigenvalue",
      "SpheroidalJoiningFactor",
      "SpheroidalPS",
      "SpheroidalPSPrime",
      "SpheroidalQS",
      "SpheroidalQSPrime",
      "SpheroidalRadialFactor",
      "SpheroidalS1",
      "SpheroidalS1Prime",
      "SpheroidalS2",
      "SpheroidalS2Prime",
      "Splice",
      "SplicedDistribution",
      "SplineClosed",
      "SplineDegree",
      "SplineKnots",
      "SplineWeights",
      "Split",
      "SplitBy",
      "SpokenString",
      "Sqrt",
      "SqrtBox",
      "SqrtBoxOptions",
      "Square",
      "SquaredEuclideanDistance",
      "SquareFreeQ",
      "SquareIntersection",
      "SquareMatrixQ",
      "SquareRepeatingElement",
      "SquaresR",
      "SquareSubset",
      "SquareSubsetEqual",
      "SquareSuperset",
      "SquareSupersetEqual",
      "SquareUnion",
      "SquareWave",
      "SSSTriangle",
      "StabilityMargins",
      "StabilityMarginsStyle",
      "StableDistribution",
      "Stack",
      "StackBegin",
      "StackComplete",
      "StackedDateListPlot",
      "StackedListPlot",
      "StackInhibit",
      "StadiumShape",
      "StandardAtmosphereData",
      "StandardDeviation",
      "StandardDeviationFilter",
      "StandardForm",
      "Standardize",
      "Standardized",
      "StandardOceanData",
      "StandbyDistribution",
      "Star",
      "StarClusterData",
      "StarData",
      "StarGraph",
      "StartAsynchronousTask",
      "StartExternalSession",
      "StartingStepSize",
      "StartOfLine",
      "StartOfString",
      "StartProcess",
      "StartScheduledTask",
      "StartupSound",
      "StartWebSession",
      "StateDimensions",
      "StateFeedbackGains",
      "StateOutputEstimator",
      "StateResponse",
      "StateSpaceModel",
      "StateSpaceRealization",
      "StateSpaceTransform",
      "StateTransformationLinearize",
      "StationaryDistribution",
      "StationaryWaveletPacketTransform",
      "StationaryWaveletTransform",
      "StatusArea",
      "StatusCentrality",
      "StepMonitor",
      "StereochemistryElements",
      "StieltjesGamma",
      "StippleShading",
      "StirlingS1",
      "StirlingS2",
      "StopAsynchronousTask",
      "StoppingPowerData",
      "StopScheduledTask",
      "StrataVariables",
      "StratonovichProcess",
      "StreamColorFunction",
      "StreamColorFunctionScaling",
      "StreamDensityPlot",
      "StreamMarkers",
      "StreamPlot",
      "StreamPoints",
      "StreamPosition",
      "Streams",
      "StreamScale",
      "StreamStyle",
      "String",
      "StringBreak",
      "StringByteCount",
      "StringCases",
      "StringContainsQ",
      "StringCount",
      "StringDelete",
      "StringDrop",
      "StringEndsQ",
      "StringExpression",
      "StringExtract",
      "StringForm",
      "StringFormat",
      "StringFreeQ",
      "StringInsert",
      "StringJoin",
      "StringLength",
      "StringMatchQ",
      "StringPadLeft",
      "StringPadRight",
      "StringPart",
      "StringPartition",
      "StringPosition",
      "StringQ",
      "StringRepeat",
      "StringReplace",
      "StringReplaceList",
      "StringReplacePart",
      "StringReverse",
      "StringRiffle",
      "StringRotateLeft",
      "StringRotateRight",
      "StringSkeleton",
      "StringSplit",
      "StringStartsQ",
      "StringTake",
      "StringTemplate",
      "StringToByteArray",
      "StringToStream",
      "StringTrim",
      "StripBoxes",
      "StripOnInput",
      "StripWrapperBoxes",
      "StrokeForm",
      "StructuralImportance",
      "StructuredArray",
      "StructuredArrayHeadQ",
      "StructuredSelection",
      "StruveH",
      "StruveL",
      "Stub",
      "StudentTDistribution",
      "Style",
      "StyleBox",
      "StyleBoxAutoDelete",
      "StyleData",
      "StyleDefinitions",
      "StyleForm",
      "StyleHints",
      "StyleKeyMapping",
      "StyleMenuListing",
      "StyleNameDialogSettings",
      "StyleNames",
      "StylePrint",
      "StyleSheetPath",
      "Subdivide",
      "Subfactorial",
      "Subgraph",
      "SubMinus",
      "SubPlus",
      "SubresultantPolynomialRemainders",
      "SubresultantPolynomials",
      "Subresultants",
      "Subscript",
      "SubscriptBox",
      "SubscriptBoxOptions",
      "Subscripted",
      "Subsequences",
      "Subset",
      "SubsetCases",
      "SubsetCount",
      "SubsetEqual",
      "SubsetMap",
      "SubsetPosition",
      "SubsetQ",
      "SubsetReplace",
      "Subsets",
      "SubStar",
      "SubstitutionSystem",
      "Subsuperscript",
      "SubsuperscriptBox",
      "SubsuperscriptBoxOptions",
      "SubtitleEncoding",
      "SubtitleTracks",
      "Subtract",
      "SubtractFrom",
      "SubtractSides",
      "SubValues",
      "Succeeds",
      "SucceedsEqual",
      "SucceedsSlantEqual",
      "SucceedsTilde",
      "Success",
      "SuchThat",
      "Sum",
      "SumConvergence",
      "SummationLayer",
      "Sunday",
      "SunPosition",
      "Sunrise",
      "Sunset",
      "SuperDagger",
      "SuperMinus",
      "SupernovaData",
      "SuperPlus",
      "Superscript",
      "SuperscriptBox",
      "SuperscriptBoxOptions",
      "Superset",
      "SupersetEqual",
      "SuperStar",
      "Surd",
      "SurdForm",
      "SurfaceAppearance",
      "SurfaceArea",
      "SurfaceColor",
      "SurfaceData",
      "SurfaceGraphics",
      "SurvivalDistribution",
      "SurvivalFunction",
      "SurvivalModel",
      "SurvivalModelFit",
      "SuspendPacket",
      "SuzukiDistribution",
      "SuzukiGroupSuz",
      "SwatchLegend",
      "Switch",
      "Symbol",
      "SymbolName",
      "SymletWavelet",
      "Symmetric",
      "SymmetricGroup",
      "SymmetricKey",
      "SymmetricMatrixQ",
      "SymmetricPolynomial",
      "SymmetricReduction",
      "Symmetrize",
      "SymmetrizedArray",
      "SymmetrizedArrayRules",
      "SymmetrizedDependentComponents",
      "SymmetrizedIndependentComponents",
      "SymmetrizedReplacePart",
      "SynchronousInitialization",
      "SynchronousUpdating",
      "Synonyms",
      "Syntax",
      "SyntaxForm",
      "SyntaxInformation",
      "SyntaxLength",
      "SyntaxPacket",
      "SyntaxQ",
      "SynthesizeMissingValues",
      "SystemCredential",
      "SystemCredentialData",
      "SystemCredentialKey",
      "SystemCredentialKeys",
      "SystemCredentialStoreObject",
      "SystemDialogInput",
      "SystemException",
      "SystemGet",
      "SystemHelpPath",
      "SystemInformation",
      "SystemInformationData",
      "SystemInstall",
      "SystemModel",
      "SystemModeler",
      "SystemModelExamples",
      "SystemModelLinearize",
      "SystemModelParametricSimulate",
      "SystemModelPlot",
      "SystemModelProgressReporting",
      "SystemModelReliability",
      "SystemModels",
      "SystemModelSimulate",
      "SystemModelSimulateSensitivity",
      "SystemModelSimulationData",
      "SystemOpen",
      "SystemOptions",
      "SystemProcessData",
      "SystemProcesses",
      "SystemsConnectionsModel",
      "SystemsModelDelay",
      "SystemsModelDelayApproximate",
      "SystemsModelDelete",
      "SystemsModelDimensions",
      "SystemsModelExtract",
      "SystemsModelFeedbackConnect",
      "SystemsModelLabels",
      "SystemsModelLinearity",
      "SystemsModelMerge",
      "SystemsModelOrder",
      "SystemsModelParallelConnect",
      "SystemsModelSeriesConnect",
      "SystemsModelStateFeedbackConnect",
      "SystemsModelVectorRelativeOrders",
      "SystemStub",
      "SystemTest",
      "Tab",
      "TabFilling",
      "Table",
      "TableAlignments",
      "TableDepth",
      "TableDirections",
      "TableForm",
      "TableHeadings",
      "TableSpacing",
      "TableView",
      "TableViewBox",
      "TableViewBoxBackground",
      "TableViewBoxItemSize",
      "TableViewBoxOptions",
      "TabSpacings",
      "TabView",
      "TabViewBox",
      "TabViewBoxOptions",
      "TagBox",
      "TagBoxNote",
      "TagBoxOptions",
      "TaggingRules",
      "TagSet",
      "TagSetDelayed",
      "TagStyle",
      "TagUnset",
      "Take",
      "TakeDrop",
      "TakeLargest",
      "TakeLargestBy",
      "TakeList",
      "TakeSmallest",
      "TakeSmallestBy",
      "TakeWhile",
      "Tally",
      "Tan",
      "Tanh",
      "TargetDevice",
      "TargetFunctions",
      "TargetSystem",
      "TargetUnits",
      "TaskAbort",
      "TaskExecute",
      "TaskObject",
      "TaskRemove",
      "TaskResume",
      "Tasks",
      "TaskSuspend",
      "TaskWait",
      "TautologyQ",
      "TelegraphProcess",
      "TemplateApply",
      "TemplateArgBox",
      "TemplateBox",
      "TemplateBoxOptions",
      "TemplateEvaluate",
      "TemplateExpression",
      "TemplateIf",
      "TemplateObject",
      "TemplateSequence",
      "TemplateSlot",
      "TemplateSlotSequence",
      "TemplateUnevaluated",
      "TemplateVerbatim",
      "TemplateWith",
      "TemporalData",
      "TemporalRegularity",
      "Temporary",
      "TemporaryVariable",
      "TensorContract",
      "TensorDimensions",
      "TensorExpand",
      "TensorProduct",
      "TensorQ",
      "TensorRank",
      "TensorReduce",
      "TensorSymmetry",
      "TensorTranspose",
      "TensorWedge",
      "TestID",
      "TestReport",
      "TestReportObject",
      "TestResultObject",
      "Tetrahedron",
      "TetrahedronBox",
      "TetrahedronBoxOptions",
      "TeXForm",
      "TeXSave",
      "Text",
      "Text3DBox",
      "Text3DBoxOptions",
      "TextAlignment",
      "TextBand",
      "TextBoundingBox",
      "TextBox",
      "TextCases",
      "TextCell",
      "TextClipboardType",
      "TextContents",
      "TextData",
      "TextElement",
      "TextForm",
      "TextGrid",
      "TextJustification",
      "TextLine",
      "TextPacket",
      "TextParagraph",
      "TextPosition",
      "TextRecognize",
      "TextSearch",
      "TextSearchReport",
      "TextSentences",
      "TextString",
      "TextStructure",
      "TextStyle",
      "TextTranslation",
      "Texture",
      "TextureCoordinateFunction",
      "TextureCoordinateScaling",
      "TextWords",
      "Therefore",
      "ThermodynamicData",
      "ThermometerGauge",
      "Thick",
      "Thickness",
      "Thin",
      "Thinning",
      "ThisLink",
      "ThompsonGroupTh",
      "Thread",
      "ThreadingLayer",
      "ThreeJSymbol",
      "Threshold",
      "Through",
      "Throw",
      "ThueMorse",
      "Thumbnail",
      "Thursday",
      "Ticks",
      "TicksStyle",
      "TideData",
      "Tilde",
      "TildeEqual",
      "TildeFullEqual",
      "TildeTilde",
      "TimeConstrained",
      "TimeConstraint",
      "TimeDirection",
      "TimeFormat",
      "TimeGoal",
      "TimelinePlot",
      "TimeObject",
      "TimeObjectQ",
      "TimeRemaining",
      "Times",
      "TimesBy",
      "TimeSeries",
      "TimeSeriesAggregate",
      "TimeSeriesForecast",
      "TimeSeriesInsert",
      "TimeSeriesInvertibility",
      "TimeSeriesMap",
      "TimeSeriesMapThread",
      "TimeSeriesModel",
      "TimeSeriesModelFit",
      "TimeSeriesResample",
      "TimeSeriesRescale",
      "TimeSeriesShift",
      "TimeSeriesThread",
      "TimeSeriesWindow",
      "TimeUsed",
      "TimeValue",
      "TimeWarpingCorrespondence",
      "TimeWarpingDistance",
      "TimeZone",
      "TimeZoneConvert",
      "TimeZoneOffset",
      "Timing",
      "Tiny",
      "TitleGrouping",
      "TitsGroupT",
      "ToBoxes",
      "ToCharacterCode",
      "ToColor",
      "ToContinuousTimeModel",
      "ToDate",
      "Today",
      "ToDiscreteTimeModel",
      "ToEntity",
      "ToeplitzMatrix",
      "ToExpression",
      "ToFileName",
      "Together",
      "Toggle",
      "ToggleFalse",
      "Toggler",
      "TogglerBar",
      "TogglerBox",
      "TogglerBoxOptions",
      "ToHeldExpression",
      "ToInvertibleTimeSeries",
      "TokenWords",
      "Tolerance",
      "ToLowerCase",
      "Tomorrow",
      "ToNumberField",
      "TooBig",
      "Tooltip",
      "TooltipBox",
      "TooltipBoxOptions",
      "TooltipDelay",
      "TooltipStyle",
      "ToonShading",
      "Top",
      "TopHatTransform",
      "ToPolarCoordinates",
      "TopologicalSort",
      "ToRadicals",
      "ToRules",
      "ToSphericalCoordinates",
      "ToString",
      "Total",
      "TotalHeight",
      "TotalLayer",
      "TotalVariationFilter",
      "TotalWidth",
      "TouchPosition",
      "TouchscreenAutoZoom",
      "TouchscreenControlPlacement",
      "ToUpperCase",
      "Tr",
      "Trace",
      "TraceAbove",
      "TraceAction",
      "TraceBackward",
      "TraceDepth",
      "TraceDialog",
      "TraceForward",
      "TraceInternal",
      "TraceLevel",
      "TraceOff",
      "TraceOn",
      "TraceOriginal",
      "TracePrint",
      "TraceScan",
      "TrackedSymbols",
      "TrackingFunction",
      "TracyWidomDistribution",
      "TradingChart",
      "TraditionalForm",
      "TraditionalFunctionNotation",
      "TraditionalNotation",
      "TraditionalOrder",
      "TrainingProgressCheckpointing",
      "TrainingProgressFunction",
      "TrainingProgressMeasurements",
      "TrainingProgressReporting",
      "TrainingStoppingCriterion",
      "TrainingUpdateSchedule",
      "TransferFunctionCancel",
      "TransferFunctionExpand",
      "TransferFunctionFactor",
      "TransferFunctionModel",
      "TransferFunctionPoles",
      "TransferFunctionTransform",
      "TransferFunctionZeros",
      "TransformationClass",
      "TransformationFunction",
      "TransformationFunctions",
      "TransformationMatrix",
      "TransformedDistribution",
      "TransformedField",
      "TransformedProcess",
      "TransformedRegion",
      "TransitionDirection",
      "TransitionDuration",
      "TransitionEffect",
      "TransitiveClosureGraph",
      "TransitiveReductionGraph",
      "Translate",
      "TranslationOptions",
      "TranslationTransform",
      "Transliterate",
      "Transparent",
      "TransparentColor",
      "Transpose",
      "TransposeLayer",
      "TrapSelection",
      "TravelDirections",
      "TravelDirectionsData",
      "TravelDistance",
      "TravelDistanceList",
      "TravelMethod",
      "TravelTime",
      "TreeForm",
      "TreeGraph",
      "TreeGraphQ",
      "TreePlot",
      "TrendStyle",
      "Triangle",
      "TriangleCenter",
      "TriangleConstruct",
      "TriangleMeasurement",
      "TriangleWave",
      "TriangularDistribution",
      "TriangulateMesh",
      "Trig",
      "TrigExpand",
      "TrigFactor",
      "TrigFactorList",
      "Trigger",
      "TrigReduce",
      "TrigToExp",
      "TrimmedMean",
      "TrimmedVariance",
      "TropicalStormData",
      "True",
      "TrueQ",
      "TruncatedDistribution",
      "TruncatedPolyhedron",
      "TsallisQExponentialDistribution",
      "TsallisQGaussianDistribution",
      "TTest",
      "Tube",
      "TubeBezierCurveBox",
      "TubeBezierCurveBoxOptions",
      "TubeBox",
      "TubeBoxOptions",
      "TubeBSplineCurveBox",
      "TubeBSplineCurveBoxOptions",
      "Tuesday",
      "TukeyLambdaDistribution",
      "TukeyWindow",
      "TunnelData",
      "Tuples",
      "TuranGraph",
      "TuringMachine",
      "TuttePolynomial",
      "TwoWayRule",
      "Typed",
      "TypeSpecifier",
      "UnateQ",
      "Uncompress",
      "UnconstrainedParameters",
      "Undefined",
      "UnderBar",
      "Underflow",
      "Underlined",
      "Underoverscript",
      "UnderoverscriptBox",
      "UnderoverscriptBoxOptions",
      "Underscript",
      "UnderscriptBox",
      "UnderscriptBoxOptions",
      "UnderseaFeatureData",
      "UndirectedEdge",
      "UndirectedGraph",
      "UndirectedGraphQ",
      "UndoOptions",
      "UndoTrackedVariables",
      "Unequal",
      "UnequalTo",
      "Unevaluated",
      "UniformDistribution",
      "UniformGraphDistribution",
      "UniformPolyhedron",
      "UniformSumDistribution",
      "Uninstall",
      "Union",
      "UnionedEntityClass",
      "UnionPlus",
      "Unique",
      "UnitaryMatrixQ",
      "UnitBox",
      "UnitConvert",
      "UnitDimensions",
      "Unitize",
      "UnitRootTest",
      "UnitSimplify",
      "UnitStep",
      "UnitSystem",
      "UnitTriangle",
      "UnitVector",
      "UnitVectorLayer",
      "UnityDimensions",
      "UniverseModelData",
      "UniversityData",
      "UnixTime",
      "Unprotect",
      "UnregisterExternalEvaluator",
      "UnsameQ",
      "UnsavedVariables",
      "Unset",
      "UnsetShared",
      "UntrackedVariables",
      "Up",
      "UpArrow",
      "UpArrowBar",
      "UpArrowDownArrow",
      "Update",
      "UpdateDynamicObjects",
      "UpdateDynamicObjectsSynchronous",
      "UpdateInterval",
      "UpdatePacletSites",
      "UpdateSearchIndex",
      "UpDownArrow",
      "UpEquilibrium",
      "UpperCaseQ",
      "UpperLeftArrow",
      "UpperRightArrow",
      "UpperTriangularize",
      "UpperTriangularMatrixQ",
      "Upsample",
      "UpSet",
      "UpSetDelayed",
      "UpTee",
      "UpTeeArrow",
      "UpTo",
      "UpValues",
      "URL",
      "URLBuild",
      "URLDecode",
      "URLDispatcher",
      "URLDownload",
      "URLDownloadSubmit",
      "URLEncode",
      "URLExecute",
      "URLExpand",
      "URLFetch",
      "URLFetchAsynchronous",
      "URLParse",
      "URLQueryDecode",
      "URLQueryEncode",
      "URLRead",
      "URLResponseTime",
      "URLSave",
      "URLSaveAsynchronous",
      "URLShorten",
      "URLSubmit",
      "UseGraphicsRange",
      "UserDefinedWavelet",
      "Using",
      "UsingFrontEnd",
      "UtilityFunction",
      "V2Get",
      "ValenceErrorHandling",
      "ValidationLength",
      "ValidationSet",
      "Value",
      "ValueBox",
      "ValueBoxOptions",
      "ValueDimensions",
      "ValueForm",
      "ValuePreprocessingFunction",
      "ValueQ",
      "Values",
      "ValuesData",
      "Variables",
      "Variance",
      "VarianceEquivalenceTest",
      "VarianceEstimatorFunction",
      "VarianceGammaDistribution",
      "VarianceTest",
      "VectorAngle",
      "VectorAround",
      "VectorAspectRatio",
      "VectorColorFunction",
      "VectorColorFunctionScaling",
      "VectorDensityPlot",
      "VectorGlyphData",
      "VectorGreater",
      "VectorGreaterEqual",
      "VectorLess",
      "VectorLessEqual",
      "VectorMarkers",
      "VectorPlot",
      "VectorPlot3D",
      "VectorPoints",
      "VectorQ",
      "VectorRange",
      "Vectors",
      "VectorScale",
      "VectorScaling",
      "VectorSizes",
      "VectorStyle",
      "Vee",
      "Verbatim",
      "Verbose",
      "VerboseConvertToPostScriptPacket",
      "VerificationTest",
      "VerifyConvergence",
      "VerifyDerivedKey",
      "VerifyDigitalSignature",
      "VerifyFileSignature",
      "VerifyInterpretation",
      "VerifySecurityCertificates",
      "VerifySolutions",
      "VerifyTestAssumptions",
      "Version",
      "VersionedPreferences",
      "VersionNumber",
      "VertexAdd",
      "VertexCapacity",
      "VertexColors",
      "VertexComponent",
      "VertexConnectivity",
      "VertexContract",
      "VertexCoordinateRules",
      "VertexCoordinates",
      "VertexCorrelationSimilarity",
      "VertexCosineSimilarity",
      "VertexCount",
      "VertexCoverQ",
      "VertexDataCoordinates",
      "VertexDegree",
      "VertexDelete",
      "VertexDiceSimilarity",
      "VertexEccentricity",
      "VertexInComponent",
      "VertexInDegree",
      "VertexIndex",
      "VertexJaccardSimilarity",
      "VertexLabeling",
      "VertexLabels",
      "VertexLabelStyle",
      "VertexList",
      "VertexNormals",
      "VertexOutComponent",
      "VertexOutDegree",
      "VertexQ",
      "VertexRenderingFunction",
      "VertexReplace",
      "VertexShape",
      "VertexShapeFunction",
      "VertexSize",
      "VertexStyle",
      "VertexTextureCoordinates",
      "VertexWeight",
      "VertexWeightedGraphQ",
      "Vertical",
      "VerticalBar",
      "VerticalForm",
      "VerticalGauge",
      "VerticalSeparator",
      "VerticalSlider",
      "VerticalTilde",
      "Video",
      "VideoEncoding",
      "VideoExtractFrames",
      "VideoFrameList",
      "VideoFrameMap",
      "VideoPause",
      "VideoPlay",
      "VideoQ",
      "VideoStop",
      "VideoStream",
      "VideoStreams",
      "VideoTimeSeries",
      "VideoTracks",
      "VideoTrim",
      "ViewAngle",
      "ViewCenter",
      "ViewMatrix",
      "ViewPoint",
      "ViewPointSelectorSettings",
      "ViewPort",
      "ViewProjection",
      "ViewRange",
      "ViewVector",
      "ViewVertical",
      "VirtualGroupData",
      "Visible",
      "VisibleCell",
      "VoiceStyleData",
      "VoigtDistribution",
      "VolcanoData",
      "Volume",
      "VonMisesDistribution",
      "VoronoiMesh",
      "WaitAll",
      "WaitAsynchronousTask",
      "WaitNext",
      "WaitUntil",
      "WakebyDistribution",
      "WalleniusHypergeometricDistribution",
      "WaringYuleDistribution",
      "WarpingCorrespondence",
      "WarpingDistance",
      "WatershedComponents",
      "WatsonUSquareTest",
      "WattsStrogatzGraphDistribution",
      "WaveletBestBasis",
      "WaveletFilterCoefficients",
      "WaveletImagePlot",
      "WaveletListPlot",
      "WaveletMapIndexed",
      "WaveletMatrixPlot",
      "WaveletPhi",
      "WaveletPsi",
      "WaveletScale",
      "WaveletScalogram",
      "WaveletThreshold",
      "WeaklyConnectedComponents",
      "WeaklyConnectedGraphComponents",
      "WeaklyConnectedGraphQ",
      "WeakStationarity",
      "WeatherData",
      "WeatherForecastData",
      "WebAudioSearch",
      "WebElementObject",
      "WeberE",
      "WebExecute",
      "WebImage",
      "WebImageSearch",
      "WebSearch",
      "WebSessionObject",
      "WebSessions",
      "WebWindowObject",
      "Wedge",
      "Wednesday",
      "WeibullDistribution",
      "WeierstrassE1",
      "WeierstrassE2",
      "WeierstrassE3",
      "WeierstrassEta1",
      "WeierstrassEta2",
      "WeierstrassEta3",
      "WeierstrassHalfPeriods",
      "WeierstrassHalfPeriodW1",
      "WeierstrassHalfPeriodW2",
      "WeierstrassHalfPeriodW3",
      "WeierstrassInvariantG2",
      "WeierstrassInvariantG3",
      "WeierstrassInvariants",
      "WeierstrassP",
      "WeierstrassPPrime",
      "WeierstrassSigma",
      "WeierstrassZeta",
      "WeightedAdjacencyGraph",
      "WeightedAdjacencyMatrix",
      "WeightedData",
      "WeightedGraphQ",
      "Weights",
      "WelchWindow",
      "WheelGraph",
      "WhenEvent",
      "Which",
      "While",
      "White",
      "WhiteNoiseProcess",
      "WhitePoint",
      "Whitespace",
      "WhitespaceCharacter",
      "WhittakerM",
      "WhittakerW",
      "WienerFilter",
      "WienerProcess",
      "WignerD",
      "WignerSemicircleDistribution",
      "WikidataData",
      "WikidataSearch",
      "WikipediaData",
      "WikipediaSearch",
      "WilksW",
      "WilksWTest",
      "WindDirectionData",
      "WindingCount",
      "WindingPolygon",
      "WindowClickSelect",
      "WindowElements",
      "WindowFloating",
      "WindowFrame",
      "WindowFrameElements",
      "WindowMargins",
      "WindowMovable",
      "WindowOpacity",
      "WindowPersistentStyles",
      "WindowSelected",
      "WindowSize",
      "WindowStatusArea",
      "WindowTitle",
      "WindowToolbars",
      "WindowWidth",
      "WindSpeedData",
      "WindVectorData",
      "WinsorizedMean",
      "WinsorizedVariance",
      "WishartMatrixDistribution",
      "With",
      "WolframAlpha",
      "WolframAlphaDate",
      "WolframAlphaQuantity",
      "WolframAlphaResult",
      "WolframLanguageData",
      "Word",
      "WordBoundary",
      "WordCharacter",
      "WordCloud",
      "WordCount",
      "WordCounts",
      "WordData",
      "WordDefinition",
      "WordFrequency",
      "WordFrequencyData",
      "WordList",
      "WordOrientation",
      "WordSearch",
      "WordSelectionFunction",
      "WordSeparators",
      "WordSpacings",
      "WordStem",
      "WordTranslation",
      "WorkingPrecision",
      "WrapAround",
      "Write",
      "WriteLine",
      "WriteString",
      "Wronskian",
      "XMLElement",
      "XMLObject",
      "XMLTemplate",
      "Xnor",
      "Xor",
      "XYZColor",
      "Yellow",
      "Yesterday",
      "YuleDissimilarity",
      "ZernikeR",
      "ZeroSymmetric",
      "ZeroTest",
      "ZeroWidthTimes",
      "Zeta",
      "ZetaZero",
      "ZIPCodeData",
      "ZipfDistribution",
      "ZoomCenter",
      "ZoomFactor",
      "ZTest",
      "ZTransform",
      "$Aborted",
      "$ActivationGroupID",
      "$ActivationKey",
      "$ActivationUserRegistered",
      "$AddOnsDirectory",
      "$AllowDataUpdates",
      "$AllowExternalChannelFunctions",
      "$AllowInternet",
      "$AssertFunction",
      "$Assumptions",
      "$AsynchronousTask",
      "$AudioDecoders",
      "$AudioEncoders",
      "$AudioInputDevices",
      "$AudioOutputDevices",
      "$BaseDirectory",
      "$BasePacletsDirectory",
      "$BatchInput",
      "$BatchOutput",
      "$BlockchainBase",
      "$BoxForms",
      "$ByteOrdering",
      "$CacheBaseDirectory",
      "$Canceled",
      "$ChannelBase",
      "$CharacterEncoding",
      "$CharacterEncodings",
      "$CloudAccountName",
      "$CloudBase",
      "$CloudConnected",
      "$CloudConnection",
      "$CloudCreditsAvailable",
      "$CloudEvaluation",
      "$CloudExpressionBase",
      "$CloudObjectNameFormat",
      "$CloudObjectURLType",
      "$CloudRootDirectory",
      "$CloudSymbolBase",
      "$CloudUserID",
      "$CloudUserUUID",
      "$CloudVersion",
      "$CloudVersionNumber",
      "$CloudWolframEngineVersionNumber",
      "$CommandLine",
      "$CompilationTarget",
      "$ConditionHold",
      "$ConfiguredKernels",
      "$Context",
      "$ContextPath",
      "$ControlActiveSetting",
      "$Cookies",
      "$CookieStore",
      "$CreationDate",
      "$CurrentLink",
      "$CurrentTask",
      "$CurrentWebSession",
      "$DataStructures",
      "$DateStringFormat",
      "$DefaultAudioInputDevice",
      "$DefaultAudioOutputDevice",
      "$DefaultFont",
      "$DefaultFrontEnd",
      "$DefaultImagingDevice",
      "$DefaultLocalBase",
      "$DefaultMailbox",
      "$DefaultNetworkInterface",
      "$DefaultPath",
      "$DefaultProxyRules",
      "$DefaultSystemCredentialStore",
      "$Display",
      "$DisplayFunction",
      "$DistributedContexts",
      "$DynamicEvaluation",
      "$Echo",
      "$EmbedCodeEnvironments",
      "$EmbeddableServices",
      "$EntityStores",
      "$Epilog",
      "$EvaluationCloudBase",
      "$EvaluationCloudObject",
      "$EvaluationEnvironment",
      "$ExportFormats",
      "$ExternalIdentifierTypes",
      "$ExternalStorageBase",
      "$Failed",
      "$FinancialDataSource",
      "$FontFamilies",
      "$FormatType",
      "$FrontEnd",
      "$FrontEndSession",
      "$GeoEntityTypes",
      "$GeoLocation",
      "$GeoLocationCity",
      "$GeoLocationCountry",
      "$GeoLocationPrecision",
      "$GeoLocationSource",
      "$HistoryLength",
      "$HomeDirectory",
      "$HTMLExportRules",
      "$HTTPCookies",
      "$HTTPRequest",
      "$IgnoreEOF",
      "$ImageFormattingWidth",
      "$ImageResolution",
      "$ImagingDevice",
      "$ImagingDevices",
      "$ImportFormats",
      "$IncomingMailSettings",
      "$InitialDirectory",
      "$Initialization",
      "$InitializationContexts",
      "$Input",
      "$InputFileName",
      "$InputStreamMethods",
      "$Inspector",
      "$InstallationDate",
      "$InstallationDirectory",
      "$InterfaceEnvironment",
      "$InterpreterTypes",
      "$IterationLimit",
      "$KernelCount",
      "$KernelID",
      "$Language",
      "$LaunchDirectory",
      "$LibraryPath",
      "$LicenseExpirationDate",
      "$LicenseID",
      "$LicenseProcesses",
      "$LicenseServer",
      "$LicenseSubprocesses",
      "$LicenseType",
      "$Line",
      "$Linked",
      "$LinkSupported",
      "$LoadedFiles",
      "$LocalBase",
      "$LocalSymbolBase",
      "$MachineAddresses",
      "$MachineDomain",
      "$MachineDomains",
      "$MachineEpsilon",
      "$MachineID",
      "$MachineName",
      "$MachinePrecision",
      "$MachineType",
      "$MaxExtraPrecision",
      "$MaxLicenseProcesses",
      "$MaxLicenseSubprocesses",
      "$MaxMachineNumber",
      "$MaxNumber",
      "$MaxPiecewiseCases",
      "$MaxPrecision",
      "$MaxRootDegree",
      "$MessageGroups",
      "$MessageList",
      "$MessagePrePrint",
      "$Messages",
      "$MinMachineNumber",
      "$MinNumber",
      "$MinorReleaseNumber",
      "$MinPrecision",
      "$MobilePhone",
      "$ModuleNumber",
      "$NetworkConnected",
      "$NetworkInterfaces",
      "$NetworkLicense",
      "$NewMessage",
      "$NewSymbol",
      "$NotebookInlineStorageLimit",
      "$Notebooks",
      "$NoValue",
      "$NumberMarks",
      "$Off",
      "$OperatingSystem",
      "$Output",
      "$OutputForms",
      "$OutputSizeLimit",
      "$OutputStreamMethods",
      "$Packages",
      "$ParentLink",
      "$ParentProcessID",
      "$PasswordFile",
      "$PatchLevelID",
      "$Path",
      "$PathnameSeparator",
      "$PerformanceGoal",
      "$Permissions",
      "$PermissionsGroupBase",
      "$PersistenceBase",
      "$PersistencePath",
      "$PipeSupported",
      "$PlotTheme",
      "$Post",
      "$Pre",
      "$PreferencesDirectory",
      "$PreInitialization",
      "$PrePrint",
      "$PreRead",
      "$PrintForms",
      "$PrintLiteral",
      "$Printout3DPreviewer",
      "$ProcessID",
      "$ProcessorCount",
      "$ProcessorType",
      "$ProductInformation",
      "$ProgramName",
      "$PublisherID",
      "$RandomState",
      "$RecursionLimit",
      "$RegisteredDeviceClasses",
      "$RegisteredUserName",
      "$ReleaseNumber",
      "$RequesterAddress",
      "$RequesterWolframID",
      "$RequesterWolframUUID",
      "$RootDirectory",
      "$ScheduledTask",
      "$ScriptCommandLine",
      "$ScriptInputString",
      "$SecuredAuthenticationKeyTokens",
      "$ServiceCreditsAvailable",
      "$Services",
      "$SessionID",
      "$SetParentLink",
      "$SharedFunctions",
      "$SharedVariables",
      "$SoundDisplay",
      "$SoundDisplayFunction",
      "$SourceLink",
      "$SSHAuthentication",
      "$SubtitleDecoders",
      "$SubtitleEncoders",
      "$SummaryBoxDataSizeLimit",
      "$SuppressInputFormHeads",
      "$SynchronousEvaluation",
      "$SyntaxHandler",
      "$System",
      "$SystemCharacterEncoding",
      "$SystemCredentialStore",
      "$SystemID",
      "$SystemMemory",
      "$SystemShell",
      "$SystemTimeZone",
      "$SystemWordLength",
      "$TemplatePath",
      "$TemporaryDirectory",
      "$TemporaryPrefix",
      "$TestFileName",
      "$TextStyle",
      "$TimedOut",
      "$TimeUnit",
      "$TimeZone",
      "$TimeZoneEntity",
      "$TopDirectory",
      "$TraceOff",
      "$TraceOn",
      "$TracePattern",
      "$TracePostAction",
      "$TracePreAction",
      "$UnitSystem",
      "$Urgent",
      "$UserAddOnsDirectory",
      "$UserAgentLanguages",
      "$UserAgentMachine",
      "$UserAgentName",
      "$UserAgentOperatingSystem",
      "$UserAgentString",
      "$UserAgentVersion",
      "$UserBaseDirectory",
      "$UserBasePacletsDirectory",
      "$UserDocumentsDirectory",
      "$Username",
      "$UserName",
      "$UserURLBase",
      "$Version",
      "$VersionNumber",
      "$VideoDecoders",
      "$VideoEncoders",
      "$VoiceStyles",
      "$WolframDocumentsDirectory",
      "$WolframID",
      "$WolframUUID"
    ];

    /*
    Language: Wolfram Language
    Description: The Wolfram Language is the programming language used in Wolfram Mathematica, a modern technical computing system spanning most areas of technical computing.
    Authors: Patrick Scheibe <patrick@halirutan.de>, Robert Jacobson <robertjacobson@acm.org>
    Website: https://www.wolfram.com/mathematica/
    Category: scientific
    */

    /** @type LanguageFn */
    function mathematica(hljs) {
      const regex = hljs.regex;
      /*
      This rather scary looking matching of Mathematica numbers is carefully explained by Robert Jacobson here:
      https://wltools.github.io/LanguageSpec/Specification/Syntax/Number-representations/
       */
      const BASE_RE = /([2-9]|[1-2]\d|[3][0-5])\^\^/;
      const BASE_DIGITS_RE = /(\w*\.\w+|\w+\.\w*|\w+)/;
      const NUMBER_RE = /(\d*\.\d+|\d+\.\d*|\d+)/;
      const BASE_NUMBER_RE = regex.either(regex.concat(BASE_RE, BASE_DIGITS_RE), NUMBER_RE);

      const ACCURACY_RE = /``[+-]?(\d*\.\d+|\d+\.\d*|\d+)/;
      const PRECISION_RE = /`([+-]?(\d*\.\d+|\d+\.\d*|\d+))?/;
      const APPROXIMATE_NUMBER_RE = regex.either(ACCURACY_RE, PRECISION_RE);

      const SCIENTIFIC_NOTATION_RE = /\*\^[+-]?\d+/;

      const MATHEMATICA_NUMBER_RE = regex.concat(
        BASE_NUMBER_RE,
        regex.optional(APPROXIMATE_NUMBER_RE),
        regex.optional(SCIENTIFIC_NOTATION_RE)
      );

      const NUMBERS = {
        className: 'number',
        relevance: 0,
        begin: MATHEMATICA_NUMBER_RE
      };

      const SYMBOL_RE = /[a-zA-Z$][a-zA-Z0-9$]*/;
      const SYSTEM_SYMBOLS_SET = new Set(SYSTEM_SYMBOLS);
      /** @type {Mode} */
      const SYMBOLS = { variants: [
        {
          className: 'builtin-symbol',
          begin: SYMBOL_RE,
          // for performance out of fear of regex.either(...Mathematica.SYSTEM_SYMBOLS)
          "on:begin": (match, response) => {
            if (!SYSTEM_SYMBOLS_SET.has(match[0])) response.ignoreMatch();
          }
        },
        {
          className: 'symbol',
          relevance: 0,
          begin: SYMBOL_RE
        }
      ] };

      const NAMED_CHARACTER = {
        className: 'named-character',
        begin: /\\\[[$a-zA-Z][$a-zA-Z0-9]+\]/
      };

      const OPERATORS = {
        className: 'operator',
        relevance: 0,
        begin: /[+\-*/,;.:@~=><&|_`'^?!%]+/
      };
      const PATTERNS = {
        className: 'pattern',
        relevance: 0,
        begin: /([a-zA-Z$][a-zA-Z0-9$]*)?_+([a-zA-Z$][a-zA-Z0-9$]*)?/
      };

      const SLOTS = {
        className: 'slot',
        relevance: 0,
        begin: /#[a-zA-Z$][a-zA-Z0-9$]*|#+[0-9]?/
      };

      const BRACES = {
        className: 'brace',
        relevance: 0,
        begin: /[[\](){}]/
      };

      const MESSAGES = {
        className: 'message-name',
        relevance: 0,
        begin: regex.concat("::", SYMBOL_RE)
      };

      return {
        name: 'Mathematica',
        aliases: [
          'mma',
          'wl'
        ],
        classNameAliases: {
          brace: 'punctuation',
          pattern: 'type',
          slot: 'type',
          symbol: 'variable',
          'named-character': 'variable',
          'builtin-symbol': 'built_in',
          'message-name': 'string'
        },
        contains: [
          hljs.COMMENT(/\(\*/, /\*\)/, { contains: [ 'self' ] }),
          PATTERNS,
          SLOTS,
          MESSAGES,
          SYMBOLS,
          NAMED_CHARACTER,
          hljs.QUOTE_STRING_MODE,
          NUMBERS,
          OPERATORS,
          BRACES
        ]
      };
    }

    /*
    Language: Matlab
    Author: Denis Bardadym <bardadymchik@gmail.com>
    Contributors: Eugene Nizhibitsky <nizhibitsky@ya.ru>, Egor Rogov <e.rogov@postgrespro.ru>
    Website: https://www.mathworks.com/products/matlab.html
    Category: scientific
    */

    /*
      Formal syntax is not published, helpful link:
      https://github.com/kornilova-l/matlab-IntelliJ-plugin/blob/master/src/main/grammar/Matlab.bnf
    */
    function matlab(hljs) {
      const TRANSPOSE_RE = '(\'|\\.\')+';
      const TRANSPOSE = {
        relevance: 0,
        contains: [ { begin: TRANSPOSE_RE } ]
      };

      return {
        name: 'Matlab',
        keywords: {
          keyword:
            'arguments break case catch classdef continue else elseif end enumeration events for function '
            + 'global if methods otherwise parfor persistent properties return spmd switch try while',
          built_in:
            'sin sind sinh asin asind asinh cos cosd cosh acos acosd acosh tan tand tanh atan '
            + 'atand atan2 atanh sec secd sech asec asecd asech csc cscd csch acsc acscd acsch cot '
            + 'cotd coth acot acotd acoth hypot exp expm1 log log1p log10 log2 pow2 realpow reallog '
            + 'realsqrt sqrt nthroot nextpow2 abs angle complex conj imag real unwrap isreal '
            + 'cplxpair fix floor ceil round mod rem sign airy besselj bessely besselh besseli '
            + 'besselk beta betainc betaln ellipj ellipke erf erfc erfcx erfinv expint gamma '
            + 'gammainc gammaln psi legendre cross dot factor isprime primes gcd lcm rat rats perms '
            + 'nchoosek factorial cart2sph cart2pol pol2cart sph2cart hsv2rgb rgb2hsv zeros ones '
            + 'eye repmat rand randn linspace logspace freqspace meshgrid accumarray size length '
            + 'ndims numel disp isempty isequal isequalwithequalnans cat reshape diag blkdiag tril '
            + 'triu fliplr flipud flipdim rot90 find sub2ind ind2sub bsxfun ndgrid permute ipermute '
            + 'shiftdim circshift squeeze isscalar isvector ans eps realmax realmin pi i|0 inf nan '
            + 'isnan isinf isfinite j|0 why compan gallery hadamard hankel hilb invhilb magic pascal '
            + 'rosser toeplitz vander wilkinson max min nanmax nanmin mean nanmean type table '
            + 'readtable writetable sortrows sort figure plot plot3 scatter scatter3 cellfun '
            + 'legend intersect ismember procrustes hold num2cell '
        },
        illegal: '(//|"|#|/\\*|\\s+/\\w+)',
        contains: [
          {
            className: 'function',
            beginKeywords: 'function',
            end: '$',
            contains: [
              hljs.UNDERSCORE_TITLE_MODE,
              {
                className: 'params',
                variants: [
                  {
                    begin: '\\(',
                    end: '\\)'
                  },
                  {
                    begin: '\\[',
                    end: '\\]'
                  }
                ]
              }
            ]
          },
          {
            className: 'built_in',
            begin: /true|false/,
            relevance: 0,
            starts: TRANSPOSE
          },
          {
            begin: '[a-zA-Z][a-zA-Z_0-9]*' + TRANSPOSE_RE,
            relevance: 0
          },
          {
            className: 'number',
            begin: hljs.C_NUMBER_RE,
            relevance: 0,
            starts: TRANSPOSE
          },
          {
            className: 'string',
            begin: '\'',
            end: '\'',
            contains: [ { begin: '\'\'' } ]
          },
          {
            begin: /\]|\}|\)/,
            relevance: 0,
            starts: TRANSPOSE
          },
          {
            className: 'string',
            begin: '"',
            end: '"',
            contains: [ { begin: '""' } ],
            starts: TRANSPOSE
          },
          hljs.COMMENT('^\\s*%\\{\\s*$', '^\\s*%\\}\\s*$'),
          hljs.COMMENT('%', '$')
        ]
      };
    }

    /*
    Language: MIPS Assembly
    Author: Nebuleon Fumika <nebuleon.fumika@gmail.com>
    Description: MIPS Assembly (up to MIPS32R2)
    Website: https://en.wikipedia.org/wiki/MIPS_architecture
    Category: assembler
    */

    function mipsasm(hljs) {
      // local labels: %?[FB]?[AT]?\d{1,2}\w+
      return {
        name: 'MIPS Assembly',
        case_insensitive: true,
        aliases: [ 'mips' ],
        keywords: {
          $pattern: '\\.?' + hljs.IDENT_RE,
          meta:
            // GNU preprocs
            '.2byte .4byte .align .ascii .asciz .balign .byte .code .data .else .end .endif .endm .endr .equ .err .exitm .extern .global .hword .if .ifdef .ifndef .include .irp .long .macro .rept .req .section .set .skip .space .text .word .ltorg ',
          built_in:
            '$0 $1 $2 $3 $4 $5 $6 $7 $8 $9 $10 $11 $12 $13 $14 $15 ' // integer registers
            + '$16 $17 $18 $19 $20 $21 $22 $23 $24 $25 $26 $27 $28 $29 $30 $31 ' // integer registers
            + 'zero at v0 v1 a0 a1 a2 a3 a4 a5 a6 a7 ' // integer register aliases
            + 't0 t1 t2 t3 t4 t5 t6 t7 t8 t9 s0 s1 s2 s3 s4 s5 s6 s7 s8 ' // integer register aliases
            + 'k0 k1 gp sp fp ra ' // integer register aliases
            + '$f0 $f1 $f2 $f2 $f4 $f5 $f6 $f7 $f8 $f9 $f10 $f11 $f12 $f13 $f14 $f15 ' // floating-point registers
            + '$f16 $f17 $f18 $f19 $f20 $f21 $f22 $f23 $f24 $f25 $f26 $f27 $f28 $f29 $f30 $f31 ' // floating-point registers
            + 'Context Random EntryLo0 EntryLo1 Context PageMask Wired EntryHi ' // Coprocessor 0 registers
            + 'HWREna BadVAddr Count Compare SR IntCtl SRSCtl SRSMap Cause EPC PRId ' // Coprocessor 0 registers
            + 'EBase Config Config1 Config2 Config3 LLAddr Debug DEPC DESAVE CacheErr ' // Coprocessor 0 registers
            + 'ECC ErrorEPC TagLo DataLo TagHi DataHi WatchLo WatchHi PerfCtl PerfCnt ' // Coprocessor 0 registers
        },
        contains: [
          {
            className: 'keyword',
            begin: '\\b(' // mnemonics
                // 32-bit integer instructions
                + 'addi?u?|andi?|b(al)?|beql?|bgez(al)?l?|bgtzl?|blezl?|bltz(al)?l?|'
                + 'bnel?|cl[oz]|divu?|ext|ins|j(al)?|jalr(\\.hb)?|jr(\\.hb)?|lbu?|lhu?|'
                + 'll|lui|lw[lr]?|maddu?|mfhi|mflo|movn|movz|move|msubu?|mthi|mtlo|mul|'
                + 'multu?|nop|nor|ori?|rotrv?|sb|sc|se[bh]|sh|sllv?|slti?u?|srav?|'
                + 'srlv?|subu?|sw[lr]?|xori?|wsbh|'
                // floating-point instructions
                + 'abs\\.[sd]|add\\.[sd]|alnv.ps|bc1[ft]l?|'
                + 'c\\.(s?f|un|u?eq|[ou]lt|[ou]le|ngle?|seq|l[et]|ng[et])\\.[sd]|'
                + '(ceil|floor|round|trunc)\\.[lw]\\.[sd]|cfc1|cvt\\.d\\.[lsw]|'
                + 'cvt\\.l\\.[dsw]|cvt\\.ps\\.s|cvt\\.s\\.[dlw]|cvt\\.s\\.p[lu]|cvt\\.w\\.[dls]|'
                + 'div\\.[ds]|ldx?c1|luxc1|lwx?c1|madd\\.[sd]|mfc1|mov[fntz]?\\.[ds]|'
                + 'msub\\.[sd]|mth?c1|mul\\.[ds]|neg\\.[ds]|nmadd\\.[ds]|nmsub\\.[ds]|'
                + 'p[lu][lu]\\.ps|recip\\.fmt|r?sqrt\\.[ds]|sdx?c1|sub\\.[ds]|suxc1|'
                + 'swx?c1|'
                // system control instructions
                + 'break|cache|d?eret|[de]i|ehb|mfc0|mtc0|pause|prefx?|rdhwr|'
                + 'rdpgpr|sdbbp|ssnop|synci?|syscall|teqi?|tgei?u?|tlb(p|r|w[ir])|'
                + 'tlti?u?|tnei?|wait|wrpgpr'
            + ')',
            end: '\\s'
          },
          // lines ending with ; or # aren't really comments, probably auto-detect fail
          hljs.COMMENT('[;#](?!\\s*$)', '$'),
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.QUOTE_STRING_MODE,
          {
            className: 'string',
            begin: '\'',
            end: '[^\\\\]\'',
            relevance: 0
          },
          {
            className: 'title',
            begin: '\\|',
            end: '\\|',
            illegal: '\\n',
            relevance: 0
          },
          {
            className: 'number',
            variants: [
              { // hex
                begin: '0x[0-9a-f]+' },
              { // bare number
                begin: '\\b-?\\d+' }
            ],
            relevance: 0
          },
          {
            className: 'symbol',
            variants: [
              { // GNU MIPS syntax
                begin: '^\\s*[a-z_\\.\\$][a-z0-9_\\.\\$]+:' },
              { // numbered local labels
                begin: '^\\s*[0-9]+:' },
              { // number local label reference (backwards, forwards)
                begin: '[0-9]+[bf]' }
            ],
            relevance: 0
          }
        ],
        // forward slashes are not allowed
        illegal: /\//
      };
    }

    /*
    Language: Nim
    Description: Nim is a statically typed compiled systems programming language.
    Website: https://nim-lang.org
    Category: system
    */

    function nim(hljs) {
      const TYPES = [
        "int",
        "int8",
        "int16",
        "int32",
        "int64",
        "uint",
        "uint8",
        "uint16",
        "uint32",
        "uint64",
        "float",
        "float32",
        "float64",
        "bool",
        "char",
        "string",
        "cstring",
        "pointer",
        "expr",
        "stmt",
        "void",
        "auto",
        "any",
        "range",
        "array",
        "openarray",
        "varargs",
        "seq",
        "set",
        "clong",
        "culong",
        "cchar",
        "cschar",
        "cshort",
        "cint",
        "csize",
        "clonglong",
        "cfloat",
        "cdouble",
        "clongdouble",
        "cuchar",
        "cushort",
        "cuint",
        "culonglong",
        "cstringarray",
        "semistatic"
      ];
      const KEYWORDS = [
        "addr",
        "and",
        "as",
        "asm",
        "bind",
        "block",
        "break",
        "case",
        "cast",
        "const",
        "continue",
        "converter",
        "discard",
        "distinct",
        "div",
        "do",
        "elif",
        "else",
        "end",
        "enum",
        "except",
        "export",
        "finally",
        "for",
        "from",
        "func",
        "generic",
        "guarded",
        "if",
        "import",
        "in",
        "include",
        "interface",
        "is",
        "isnot",
        "iterator",
        "let",
        "macro",
        "method",
        "mixin",
        "mod",
        "nil",
        "not",
        "notin",
        "object",
        "of",
        "or",
        "out",
        "proc",
        "ptr",
        "raise",
        "ref",
        "return",
        "shared",
        "shl",
        "shr",
        "static",
        "template",
        "try",
        "tuple",
        "type",
        "using",
        "var",
        "when",
        "while",
        "with",
        "without",
        "xor",
        "yield"
      ];
      const BUILT_INS = [
        "stdin",
        "stdout",
        "stderr",
        "result"
      ];
      const LITERALS = [
        "true",
        "false"
      ];
      return {
        name: 'Nim',
        keywords: {
          keyword: KEYWORDS,
          literal: LITERALS,
          type: TYPES,
          built_in: BUILT_INS
        },
        contains: [
          {
            className: 'meta', // Actually pragma
            begin: /\{\./,
            end: /\.\}/,
            relevance: 10
          },
          {
            className: 'string',
            begin: /[a-zA-Z]\w*"/,
            end: /"/,
            contains: [ { begin: /""/ } ]
          },
          {
            className: 'string',
            begin: /([a-zA-Z]\w*)?"""/,
            end: /"""/
          },
          hljs.QUOTE_STRING_MODE,
          {
            className: 'type',
            begin: /\b[A-Z]\w+\b/,
            relevance: 0
          },
          {
            className: 'number',
            relevance: 0,
            variants: [
              { begin: /\b(0[xX][0-9a-fA-F][_0-9a-fA-F]*)('?[iIuU](8|16|32|64))?/ },
              { begin: /\b(0o[0-7][_0-7]*)('?[iIuUfF](8|16|32|64))?/ },
              { begin: /\b(0(b|B)[01][_01]*)('?[iIuUfF](8|16|32|64))?/ },
              { begin: /\b(\d[_\d]*)('?[iIuUfF](8|16|32|64))?/ }
            ]
          },
          hljs.HASH_COMMENT_MODE
        ]
      };
    }

    /*
    Language: Nix
    Author: Domen Kožar <domen@dev.si>
    Description: Nix functional language
    Website: http://nixos.org/nix
    */

    function nix(hljs) {
      const KEYWORDS = {
        keyword: [
          "rec",
          "with",
          "let",
          "in",
          "inherit",
          "assert",
          "if",
          "else",
          "then"
        ],
        literal: [
          "true",
          "false",
          "or",
          "and",
          "null"
        ],
        built_in: [
          "import",
          "abort",
          "baseNameOf",
          "dirOf",
          "isNull",
          "builtins",
          "map",
          "removeAttrs",
          "throw",
          "toString",
          "derivation"
        ]
      };
      const ANTIQUOTE = {
        className: 'subst',
        begin: /\$\{/,
        end: /\}/,
        keywords: KEYWORDS
      };
      const ESCAPED_DOLLAR = {
        className: 'char.escape',
        begin: /''\$/,
      };
      const ATTRS = {
        begin: /[a-zA-Z0-9-_]+(\s*=)/,
        returnBegin: true,
        relevance: 0,
        contains: [
          {
            className: 'attr',
            begin: /\S+/,
            relevance: 0.2
          }
        ]
      };
      const STRING = {
        className: 'string',
        contains: [ ESCAPED_DOLLAR, ANTIQUOTE ],
        variants: [
          {
            begin: "''",
            end: "''"
          },
          {
            begin: '"',
            end: '"'
          }
        ]
      };
      const EXPRESSIONS = [
        hljs.NUMBER_MODE,
        hljs.HASH_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        STRING,
        ATTRS
      ];
      ANTIQUOTE.contains = EXPRESSIONS;
      return {
        name: 'Nix',
        aliases: [ "nixos" ],
        keywords: KEYWORDS,
        contains: EXPRESSIONS
      };
    }

    /*
    Language: Objective-C
    Author: Valerii Hiora <valerii.hiora@gmail.com>
    Contributors: Angel G. Olloqui <angelgarcia.mail@gmail.com>, Matt Diephouse <matt@diephouse.com>, Andrew Farmer <ahfarmer@gmail.com>, Minh Nguyễn <mxn@1ec5.org>
    Website: https://developer.apple.com/documentation/objectivec
    Category: common
    */

    function objectivec(hljs) {
      const API_CLASS = {
        className: 'built_in',
        begin: '\\b(AV|CA|CF|CG|CI|CL|CM|CN|CT|MK|MP|MTK|MTL|NS|SCN|SK|UI|WK|XC)\\w+'
      };
      const IDENTIFIER_RE = /[a-zA-Z@][a-zA-Z0-9_]*/;
      const TYPES = [
        "int",
        "float",
        "char",
        "unsigned",
        "signed",
        "short",
        "long",
        "double",
        "wchar_t",
        "unichar",
        "void",
        "bool",
        "BOOL",
        "id|0",
        "_Bool"
      ];
      const KWS = [
        "while",
        "export",
        "sizeof",
        "typedef",
        "const",
        "struct",
        "for",
        "union",
        "volatile",
        "static",
        "mutable",
        "if",
        "do",
        "return",
        "goto",
        "enum",
        "else",
        "break",
        "extern",
        "asm",
        "case",
        "default",
        "register",
        "explicit",
        "typename",
        "switch",
        "continue",
        "inline",
        "readonly",
        "assign",
        "readwrite",
        "self",
        "@synchronized",
        "id",
        "typeof",
        "nonatomic",
        "IBOutlet",
        "IBAction",
        "strong",
        "weak",
        "copy",
        "in",
        "out",
        "inout",
        "bycopy",
        "byref",
        "oneway",
        "__strong",
        "__weak",
        "__block",
        "__autoreleasing",
        "@private",
        "@protected",
        "@public",
        "@try",
        "@property",
        "@end",
        "@throw",
        "@catch",
        "@finally",
        "@autoreleasepool",
        "@synthesize",
        "@dynamic",
        "@selector",
        "@optional",
        "@required",
        "@encode",
        "@package",
        "@import",
        "@defs",
        "@compatibility_alias",
        "__bridge",
        "__bridge_transfer",
        "__bridge_retained",
        "__bridge_retain",
        "__covariant",
        "__contravariant",
        "__kindof",
        "_Nonnull",
        "_Nullable",
        "_Null_unspecified",
        "__FUNCTION__",
        "__PRETTY_FUNCTION__",
        "__attribute__",
        "getter",
        "setter",
        "retain",
        "unsafe_unretained",
        "nonnull",
        "nullable",
        "null_unspecified",
        "null_resettable",
        "class",
        "instancetype",
        "NS_DESIGNATED_INITIALIZER",
        "NS_UNAVAILABLE",
        "NS_REQUIRES_SUPER",
        "NS_RETURNS_INNER_POINTER",
        "NS_INLINE",
        "NS_AVAILABLE",
        "NS_DEPRECATED",
        "NS_ENUM",
        "NS_OPTIONS",
        "NS_SWIFT_UNAVAILABLE",
        "NS_ASSUME_NONNULL_BEGIN",
        "NS_ASSUME_NONNULL_END",
        "NS_REFINED_FOR_SWIFT",
        "NS_SWIFT_NAME",
        "NS_SWIFT_NOTHROW",
        "NS_DURING",
        "NS_HANDLER",
        "NS_ENDHANDLER",
        "NS_VALUERETURN",
        "NS_VOIDRETURN"
      ];
      const LITERALS = [
        "false",
        "true",
        "FALSE",
        "TRUE",
        "nil",
        "YES",
        "NO",
        "NULL"
      ];
      const BUILT_INS = [
        "dispatch_once_t",
        "dispatch_queue_t",
        "dispatch_sync",
        "dispatch_async",
        "dispatch_once"
      ];
      const KEYWORDS = {
        "variable.language": [
          "this",
          "super"
        ],
        $pattern: IDENTIFIER_RE,
        keyword: KWS,
        literal: LITERALS,
        built_in: BUILT_INS,
        type: TYPES
      };
      const CLASS_KEYWORDS = {
        $pattern: IDENTIFIER_RE,
        keyword: [
          "@interface",
          "@class",
          "@protocol",
          "@implementation"
        ]
      };
      return {
        name: 'Objective-C',
        aliases: [
          'mm',
          'objc',
          'obj-c',
          'obj-c++',
          'objective-c++'
        ],
        keywords: KEYWORDS,
        illegal: '</',
        contains: [
          API_CLASS,
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.C_NUMBER_MODE,
          hljs.QUOTE_STRING_MODE,
          hljs.APOS_STRING_MODE,
          {
            className: 'string',
            variants: [
              {
                begin: '@"',
                end: '"',
                illegal: '\\n',
                contains: [ hljs.BACKSLASH_ESCAPE ]
              }
            ]
          },
          {
            className: 'meta',
            begin: /#\s*[a-z]+\b/,
            end: /$/,
            keywords: { keyword:
                'if else elif endif define undef warning error line '
                + 'pragma ifdef ifndef include' },
            contains: [
              {
                begin: /\\\n/,
                relevance: 0
              },
              hljs.inherit(hljs.QUOTE_STRING_MODE, { className: 'string' }),
              {
                className: 'string',
                begin: /<.*?>/,
                end: /$/,
                illegal: '\\n'
              },
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ]
          },
          {
            className: 'class',
            begin: '(' + CLASS_KEYWORDS.keyword.join('|') + ')\\b',
            end: /(\{|$)/,
            excludeEnd: true,
            keywords: CLASS_KEYWORDS,
            contains: [ hljs.UNDERSCORE_TITLE_MODE ]
          },
          {
            begin: '\\.' + hljs.UNDERSCORE_IDENT_RE,
            relevance: 0
          }
        ]
      };
    }

    /*
    Language: OCaml
    Author: Mehdi Dogguy <mehdi@dogguy.org>
    Contributors: Nicolas Braud-Santoni <nicolas.braud-santoni@ens-cachan.fr>, Mickael Delahaye <mickael.delahaye@gmail.com>
    Description: OCaml language definition.
    Website: https://ocaml.org
    Category: functional
    */

    function ocaml(hljs) {
      /* missing support for heredoc-like string (OCaml 4.0.2+) */
      return {
        name: 'OCaml',
        aliases: [ 'ml' ],
        keywords: {
          $pattern: '[a-z_]\\w*!?',
          keyword:
            'and as assert asr begin class constraint do done downto else end '
            + 'exception external for fun function functor if in include '
            + 'inherit! inherit initializer land lazy let lor lsl lsr lxor match method!|10 method '
            + 'mod module mutable new object of open! open or private rec sig struct '
            + 'then to try type val! val virtual when while with '
            /* camlp4 */
            + 'parser value',
          built_in:
            /* built-in types */
            'array bool bytes char exn|5 float int int32 int64 list lazy_t|5 nativeint|5 string unit '
            /* (some) types in Pervasives */
            + 'in_channel out_channel ref',
          literal:
            'true false'
        },
        illegal: /\/\/|>>/,
        contains: [
          {
            className: 'literal',
            begin: '\\[(\\|\\|)?\\]|\\(\\)',
            relevance: 0
          },
          hljs.COMMENT(
            '\\(\\*',
            '\\*\\)',
            { contains: [ 'self' ] }
          ),
          { /* type variable */
            className: 'symbol',
            begin: '\'[A-Za-z_](?!\')[\\w\']*'
            /* the grammar is ambiguous on how 'a'b should be interpreted but not the compiler */
          },
          { /* polymorphic variant */
            className: 'type',
            begin: '`[A-Z][\\w\']*'
          },
          { /* module or constructor */
            className: 'type',
            begin: '\\b[A-Z][\\w\']*',
            relevance: 0
          },
          { /* don't color identifiers, but safely catch all identifiers with ' */
            begin: '[a-z_]\\w*\'[\\w\']*',
            relevance: 0
          },
          hljs.inherit(hljs.APOS_STRING_MODE, {
            className: 'string',
            relevance: 0
          }),
          hljs.inherit(hljs.QUOTE_STRING_MODE, { illegal: null }),
          {
            className: 'number',
            begin:
              '\\b(0[xX][a-fA-F0-9_]+[Lln]?|'
              + '0[oO][0-7_]+[Lln]?|'
              + '0[bB][01_]+[Lln]?|'
              + '[0-9][0-9_]*([Lln]|(\\.[0-9_]*)?([eE][-+]?[0-9_]+)?)?)',
            relevance: 0
          },
          { begin: /->/ // relevance booster
          }
        ]
      };
    }

    /*
    Language: Perl
    Author: Peter Leonov <gojpeg@yandex.ru>
    Website: https://www.perl.org
    Category: common
    */

    /** @type LanguageFn */
    function perl(hljs) {
      const regex = hljs.regex;
      const KEYWORDS = [
        'abs',
        'accept',
        'alarm',
        'and',
        'atan2',
        'bind',
        'binmode',
        'bless',
        'break',
        'caller',
        'chdir',
        'chmod',
        'chomp',
        'chop',
        'chown',
        'chr',
        'chroot',
        'close',
        'closedir',
        'connect',
        'continue',
        'cos',
        'crypt',
        'dbmclose',
        'dbmopen',
        'defined',
        'delete',
        'die',
        'do',
        'dump',
        'each',
        'else',
        'elsif',
        'endgrent',
        'endhostent',
        'endnetent',
        'endprotoent',
        'endpwent',
        'endservent',
        'eof',
        'eval',
        'exec',
        'exists',
        'exit',
        'exp',
        'fcntl',
        'fileno',
        'flock',
        'for',
        'foreach',
        'fork',
        'format',
        'formline',
        'getc',
        'getgrent',
        'getgrgid',
        'getgrnam',
        'gethostbyaddr',
        'gethostbyname',
        'gethostent',
        'getlogin',
        'getnetbyaddr',
        'getnetbyname',
        'getnetent',
        'getpeername',
        'getpgrp',
        'getpriority',
        'getprotobyname',
        'getprotobynumber',
        'getprotoent',
        'getpwent',
        'getpwnam',
        'getpwuid',
        'getservbyname',
        'getservbyport',
        'getservent',
        'getsockname',
        'getsockopt',
        'given',
        'glob',
        'gmtime',
        'goto',
        'grep',
        'gt',
        'hex',
        'if',
        'index',
        'int',
        'ioctl',
        'join',
        'keys',
        'kill',
        'last',
        'lc',
        'lcfirst',
        'length',
        'link',
        'listen',
        'local',
        'localtime',
        'log',
        'lstat',
        'lt',
        'ma',
        'map',
        'mkdir',
        'msgctl',
        'msgget',
        'msgrcv',
        'msgsnd',
        'my',
        'ne',
        'next',
        'no',
        'not',
        'oct',
        'open',
        'opendir',
        'or',
        'ord',
        'our',
        'pack',
        'package',
        'pipe',
        'pop',
        'pos',
        'print',
        'printf',
        'prototype',
        'push',
        'q|0',
        'qq',
        'quotemeta',
        'qw',
        'qx',
        'rand',
        'read',
        'readdir',
        'readline',
        'readlink',
        'readpipe',
        'recv',
        'redo',
        'ref',
        'rename',
        'require',
        'reset',
        'return',
        'reverse',
        'rewinddir',
        'rindex',
        'rmdir',
        'say',
        'scalar',
        'seek',
        'seekdir',
        'select',
        'semctl',
        'semget',
        'semop',
        'send',
        'setgrent',
        'sethostent',
        'setnetent',
        'setpgrp',
        'setpriority',
        'setprotoent',
        'setpwent',
        'setservent',
        'setsockopt',
        'shift',
        'shmctl',
        'shmget',
        'shmread',
        'shmwrite',
        'shutdown',
        'sin',
        'sleep',
        'socket',
        'socketpair',
        'sort',
        'splice',
        'split',
        'sprintf',
        'sqrt',
        'srand',
        'stat',
        'state',
        'study',
        'sub',
        'substr',
        'symlink',
        'syscall',
        'sysopen',
        'sysread',
        'sysseek',
        'system',
        'syswrite',
        'tell',
        'telldir',
        'tie',
        'tied',
        'time',
        'times',
        'tr',
        'truncate',
        'uc',
        'ucfirst',
        'umask',
        'undef',
        'unless',
        'unlink',
        'unpack',
        'unshift',
        'untie',
        'until',
        'use',
        'utime',
        'values',
        'vec',
        'wait',
        'waitpid',
        'wantarray',
        'warn',
        'when',
        'while',
        'write',
        'x|0',
        'xor',
        'y|0'
      ];

      // https://perldoc.perl.org/perlre#Modifiers
      const REGEX_MODIFIERS = /[dualxmsipngr]{0,12}/; // aa and xx are valid, making max length 12
      const PERL_KEYWORDS = {
        $pattern: /[\w.]+/,
        keyword: KEYWORDS.join(" ")
      };
      const SUBST = {
        className: 'subst',
        begin: '[$@]\\{',
        end: '\\}',
        keywords: PERL_KEYWORDS
      };
      const METHOD = {
        begin: /->\{/,
        end: /\}/
        // contains defined later
      };
      const VAR = { variants: [
        { begin: /\$\d/ },
        { begin: regex.concat(
          /[$%@](\^\w\b|#\w+(::\w+)*|\{\w+\}|\w+(::\w*)*)/,
          // negative look-ahead tries to avoid matching patterns that are not
          // Perl at all like $ident$, @ident@, etc.
          `(?![A-Za-z])(?![@$%])`
        ) },
        {
          begin: /[$%@][^\s\w{]/,
          relevance: 0
        }
      ] };
      const STRING_CONTAINS = [
        hljs.BACKSLASH_ESCAPE,
        SUBST,
        VAR
      ];
      const REGEX_DELIMS = [
        /!/,
        /\//,
        /\|/,
        /\?/,
        /'/,
        /"/, // valid but infrequent and weird
        /#/ // valid but infrequent and weird
      ];
      /**
       * @param {string|RegExp} prefix
       * @param {string|RegExp} open
       * @param {string|RegExp} close
       */
      const PAIRED_DOUBLE_RE = (prefix, open, close = '\\1') => {
        const middle = (close === '\\1')
          ? close
          : regex.concat(close, open);
        return regex.concat(
          regex.concat("(?:", prefix, ")"),
          open,
          /(?:\\.|[^\\\/])*?/,
          middle,
          /(?:\\.|[^\\\/])*?/,
          close,
          REGEX_MODIFIERS
        );
      };
      /**
       * @param {string|RegExp} prefix
       * @param {string|RegExp} open
       * @param {string|RegExp} close
       */
      const PAIRED_RE = (prefix, open, close) => {
        return regex.concat(
          regex.concat("(?:", prefix, ")"),
          open,
          /(?:\\.|[^\\\/])*?/,
          close,
          REGEX_MODIFIERS
        );
      };
      const PERL_DEFAULT_CONTAINS = [
        VAR,
        hljs.HASH_COMMENT_MODE,
        hljs.COMMENT(
          /^=\w/,
          /=cut/,
          { endsWithParent: true }
        ),
        METHOD,
        {
          className: 'string',
          contains: STRING_CONTAINS,
          variants: [
            {
              begin: 'q[qwxr]?\\s*\\(',
              end: '\\)',
              relevance: 5
            },
            {
              begin: 'q[qwxr]?\\s*\\[',
              end: '\\]',
              relevance: 5
            },
            {
              begin: 'q[qwxr]?\\s*\\{',
              end: '\\}',
              relevance: 5
            },
            {
              begin: 'q[qwxr]?\\s*\\|',
              end: '\\|',
              relevance: 5
            },
            {
              begin: 'q[qwxr]?\\s*<',
              end: '>',
              relevance: 5
            },
            {
              begin: 'qw\\s+q',
              end: 'q',
              relevance: 5
            },
            {
              begin: '\'',
              end: '\'',
              contains: [ hljs.BACKSLASH_ESCAPE ]
            },
            {
              begin: '"',
              end: '"'
            },
            {
              begin: '`',
              end: '`',
              contains: [ hljs.BACKSLASH_ESCAPE ]
            },
            {
              begin: /\{\w+\}/,
              relevance: 0
            },
            {
              begin: '-?\\w+\\s*=>',
              relevance: 0
            }
          ]
        },
        {
          className: 'number',
          begin: '(\\b0[0-7_]+)|(\\b0x[0-9a-fA-F_]+)|(\\b[1-9][0-9_]*(\\.[0-9_]+)?)|[0_]\\b',
          relevance: 0
        },
        { // regexp container
          begin: '(\\/\\/|' + hljs.RE_STARTERS_RE + '|\\b(split|return|print|reverse|grep)\\b)\\s*',
          keywords: 'split return print reverse grep',
          relevance: 0,
          contains: [
            hljs.HASH_COMMENT_MODE,
            {
              className: 'regexp',
              variants: [
                // allow matching common delimiters
                { begin: PAIRED_DOUBLE_RE("s|tr|y", regex.either(...REGEX_DELIMS, { capture: true })) },
                // and then paired delmis
                { begin: PAIRED_DOUBLE_RE("s|tr|y", "\\(", "\\)") },
                { begin: PAIRED_DOUBLE_RE("s|tr|y", "\\[", "\\]") },
                { begin: PAIRED_DOUBLE_RE("s|tr|y", "\\{", "\\}") }
              ],
              relevance: 2
            },
            {
              className: 'regexp',
              variants: [
                {
                  // could be a comment in many languages so do not count
                  // as relevant
                  begin: /(m|qr)\/\//,
                  relevance: 0
                },
                // prefix is optional with /regex/
                { begin: PAIRED_RE("(?:m|qr)?", /\//, /\//) },
                // allow matching common delimiters
                { begin: PAIRED_RE("m|qr", regex.either(...REGEX_DELIMS, { capture: true }), /\1/) },
                // allow common paired delmins
                { begin: PAIRED_RE("m|qr", /\(/, /\)/) },
                { begin: PAIRED_RE("m|qr", /\[/, /\]/) },
                { begin: PAIRED_RE("m|qr", /\{/, /\}/) }
              ]
            }
          ]
        },
        {
          className: 'function',
          beginKeywords: 'sub',
          end: '(\\s*\\(.*?\\))?[;{]',
          excludeEnd: true,
          relevance: 5,
          contains: [ hljs.TITLE_MODE ]
        },
        {
          begin: '-\\w\\b',
          relevance: 0
        },
        {
          begin: "^__DATA__$",
          end: "^__END__$",
          subLanguage: 'mojolicious',
          contains: [
            {
              begin: "^@@.*",
              end: "$",
              className: "comment"
            }
          ]
        }
      ];
      SUBST.contains = PERL_DEFAULT_CONTAINS;
      METHOD.contains = PERL_DEFAULT_CONTAINS;

      return {
        name: 'Perl',
        aliases: [
          'pl',
          'pm'
        ],
        keywords: PERL_KEYWORDS,
        contains: PERL_DEFAULT_CONTAINS
      };
    }

    /*
    Language: PHP
    Author: Victor Karamzin <Victor.Karamzin@enterra-inc.com>
    Contributors: Evgeny Stepanischev <imbolk@gmail.com>, Ivan Sagalaev <maniac@softwaremaniacs.org>
    Website: https://www.php.net
    Category: common
    */

    /**
     * @param {HLJSApi} hljs
     * @returns {LanguageDetail}
     * */
    function php(hljs) {
      const regex = hljs.regex;
      // negative look-ahead tries to avoid matching patterns that are not
      // Perl at all like $ident$, @ident@, etc.
      const NOT_PERL_ETC = /(?![A-Za-z0-9])(?![$])/;
      const IDENT_RE = regex.concat(
        /[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/,
        NOT_PERL_ETC);
      // Will not detect camelCase classes
      const PASCAL_CASE_CLASS_NAME_RE = regex.concat(
        /(\\?[A-Z][a-z0-9_\x7f-\xff]+|\\?[A-Z]+(?=[A-Z][a-z0-9_\x7f-\xff])){1,}/,
        NOT_PERL_ETC);
      const VARIABLE = {
        scope: 'variable',
        match: '\\$+' + IDENT_RE,
      };
      const PREPROCESSOR = {
        scope: 'meta',
        variants: [
          { begin: /<\?php/, relevance: 10 }, // boost for obvious PHP
          { begin: /<\?=/ },
          // less relevant per PSR-1 which says not to use short-tags
          { begin: /<\?/, relevance: 0.1 },
          { begin: /\?>/ } // end php tag
        ]
      };
      const SUBST = {
        scope: 'subst',
        variants: [
          { begin: /\$\w+/ },
          {
            begin: /\{\$/,
            end: /\}/
          }
        ]
      };
      const SINGLE_QUOTED = hljs.inherit(hljs.APOS_STRING_MODE, { illegal: null, });
      const DOUBLE_QUOTED = hljs.inherit(hljs.QUOTE_STRING_MODE, {
        illegal: null,
        contains: hljs.QUOTE_STRING_MODE.contains.concat(SUBST),
      });
      const HEREDOC = hljs.END_SAME_AS_BEGIN({
        begin: /<<<[ \t]*(\w+)\n/,
        end: /[ \t]*(\w+)\b/,
        contains: hljs.QUOTE_STRING_MODE.contains.concat(SUBST),
      });
      // list of valid whitespaces because non-breaking space might be part of a IDENT_RE
      const WHITESPACE = '[ \t\n]';
      const STRING = {
        scope: 'string',
        variants: [
          DOUBLE_QUOTED,
          SINGLE_QUOTED,
          HEREDOC
        ]
      };
      const NUMBER = {
        scope: 'number',
        variants: [
          { begin: `\\b0[bB][01]+(?:_[01]+)*\\b` }, // Binary w/ underscore support
          { begin: `\\b0[oO][0-7]+(?:_[0-7]+)*\\b` }, // Octals w/ underscore support
          { begin: `\\b0[xX][\\da-fA-F]+(?:_[\\da-fA-F]+)*\\b` }, // Hex w/ underscore support
          // Decimals w/ underscore support, with optional fragments and scientific exponent (e) suffix.
          { begin: `(?:\\b\\d+(?:_\\d+)*(\\.(?:\\d+(?:_\\d+)*))?|\\B\\.\\d+)(?:[eE][+-]?\\d+)?` }
        ],
        relevance: 0
      };
      const LITERALS = [
        "false",
        "null",
        "true"
      ];
      const KWS = [
        // Magic constants:
        // <https://www.php.net/manual/en/language.constants.predefined.php>
        "__CLASS__",
        "__DIR__",
        "__FILE__",
        "__FUNCTION__",
        "__COMPILER_HALT_OFFSET__",
        "__LINE__",
        "__METHOD__",
        "__NAMESPACE__",
        "__TRAIT__",
        // Function that look like language construct or language construct that look like function:
        // List of keywords that may not require parenthesis
        "die",
        "echo",
        "exit",
        "include",
        "include_once",
        "print",
        "require",
        "require_once",
        // These are not language construct (function) but operate on the currently-executing function and can access the current symbol table
        // 'compact extract func_get_arg func_get_args func_num_args get_called_class get_parent_class ' +
        // Other keywords:
        // <https://www.php.net/manual/en/reserved.php>
        // <https://www.php.net/manual/en/language.types.type-juggling.php>
        "array",
        "abstract",
        "and",
        "as",
        "binary",
        "bool",
        "boolean",
        "break",
        "callable",
        "case",
        "catch",
        "class",
        "clone",
        "const",
        "continue",
        "declare",
        "default",
        "do",
        "double",
        "else",
        "elseif",
        "empty",
        "enddeclare",
        "endfor",
        "endforeach",
        "endif",
        "endswitch",
        "endwhile",
        "enum",
        "eval",
        "extends",
        "final",
        "finally",
        "float",
        "for",
        "foreach",
        "from",
        "global",
        "goto",
        "if",
        "implements",
        "instanceof",
        "insteadof",
        "int",
        "integer",
        "interface",
        "isset",
        "iterable",
        "list",
        "match|0",
        "mixed",
        "new",
        "never",
        "object",
        "or",
        "private",
        "protected",
        "public",
        "readonly",
        "real",
        "return",
        "string",
        "switch",
        "throw",
        "trait",
        "try",
        "unset",
        "use",
        "var",
        "void",
        "while",
        "xor",
        "yield"
      ];

      const BUILT_INS = [
        // Standard PHP library:
        // <https://www.php.net/manual/en/book.spl.php>
        "Error|0",
        "AppendIterator",
        "ArgumentCountError",
        "ArithmeticError",
        "ArrayIterator",
        "ArrayObject",
        "AssertionError",
        "BadFunctionCallException",
        "BadMethodCallException",
        "CachingIterator",
        "CallbackFilterIterator",
        "CompileError",
        "Countable",
        "DirectoryIterator",
        "DivisionByZeroError",
        "DomainException",
        "EmptyIterator",
        "ErrorException",
        "Exception",
        "FilesystemIterator",
        "FilterIterator",
        "GlobIterator",
        "InfiniteIterator",
        "InvalidArgumentException",
        "IteratorIterator",
        "LengthException",
        "LimitIterator",
        "LogicException",
        "MultipleIterator",
        "NoRewindIterator",
        "OutOfBoundsException",
        "OutOfRangeException",
        "OuterIterator",
        "OverflowException",
        "ParentIterator",
        "ParseError",
        "RangeException",
        "RecursiveArrayIterator",
        "RecursiveCachingIterator",
        "RecursiveCallbackFilterIterator",
        "RecursiveDirectoryIterator",
        "RecursiveFilterIterator",
        "RecursiveIterator",
        "RecursiveIteratorIterator",
        "RecursiveRegexIterator",
        "RecursiveTreeIterator",
        "RegexIterator",
        "RuntimeException",
        "SeekableIterator",
        "SplDoublyLinkedList",
        "SplFileInfo",
        "SplFileObject",
        "SplFixedArray",
        "SplHeap",
        "SplMaxHeap",
        "SplMinHeap",
        "SplObjectStorage",
        "SplObserver",
        "SplPriorityQueue",
        "SplQueue",
        "SplStack",
        "SplSubject",
        "SplTempFileObject",
        "TypeError",
        "UnderflowException",
        "UnexpectedValueException",
        "UnhandledMatchError",
        // Reserved interfaces:
        // <https://www.php.net/manual/en/reserved.interfaces.php>
        "ArrayAccess",
        "BackedEnum",
        "Closure",
        "Fiber",
        "Generator",
        "Iterator",
        "IteratorAggregate",
        "Serializable",
        "Stringable",
        "Throwable",
        "Traversable",
        "UnitEnum",
        "WeakReference",
        "WeakMap",
        // Reserved classes:
        // <https://www.php.net/manual/en/reserved.classes.php>
        "Directory",
        "__PHP_Incomplete_Class",
        "parent",
        "php_user_filter",
        "self",
        "static",
        "stdClass"
      ];

      /** Dual-case keywords
       *
       * ["then","FILE"] =>
       *     ["then", "THEN", "FILE", "file"]
       *
       * @param {string[]} items */
      const dualCase = (items) => {
        /** @type string[] */
        const result = [];
        items.forEach(item => {
          result.push(item);
          if (item.toLowerCase() === item) {
            result.push(item.toUpperCase());
          } else {
            result.push(item.toLowerCase());
          }
        });
        return result;
      };

      const KEYWORDS = {
        keyword: KWS,
        literal: dualCase(LITERALS),
        built_in: BUILT_INS,
      };

      /**
       * @param {string[]} items */
      const normalizeKeywords = (items) => {
        return items.map(item => {
          return item.replace(/\|\d+$/, "");
        });
      };

      const CONSTRUCTOR_CALL = { variants: [
        {
          match: [
            /new/,
            regex.concat(WHITESPACE, "+"),
            // to prevent built ins from being confused as the class constructor call
            regex.concat("(?!", normalizeKeywords(BUILT_INS).join("\\b|"), "\\b)"),
            PASCAL_CASE_CLASS_NAME_RE,
          ],
          scope: {
            1: "keyword",
            4: "title.class",
          },
        }
      ] };

      const CONSTANT_REFERENCE = regex.concat(IDENT_RE, "\\b(?!\\()");

      const LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON = { variants: [
        {
          match: [
            regex.concat(
              /::/,
              regex.lookahead(/(?!class\b)/)
            ),
            CONSTANT_REFERENCE,
          ],
          scope: { 2: "variable.constant", },
        },
        {
          match: [
            /::/,
            /class/,
          ],
          scope: { 2: "variable.language", },
        },
        {
          match: [
            PASCAL_CASE_CLASS_NAME_RE,
            regex.concat(
              /::/,
              regex.lookahead(/(?!class\b)/)
            ),
            CONSTANT_REFERENCE,
          ],
          scope: {
            1: "title.class",
            3: "variable.constant",
          },
        },
        {
          match: [
            PASCAL_CASE_CLASS_NAME_RE,
            regex.concat(
              "::",
              regex.lookahead(/(?!class\b)/)
            ),
          ],
          scope: { 1: "title.class", },
        },
        {
          match: [
            PASCAL_CASE_CLASS_NAME_RE,
            /::/,
            /class/,
          ],
          scope: {
            1: "title.class",
            3: "variable.language",
          },
        }
      ] };

      const NAMED_ARGUMENT = {
        scope: 'attr',
        match: regex.concat(IDENT_RE, regex.lookahead(':'), regex.lookahead(/(?!::)/)),
      };
      const PARAMS_MODE = {
        relevance: 0,
        begin: /\(/,
        end: /\)/,
        keywords: KEYWORDS,
        contains: [
          NAMED_ARGUMENT,
          VARIABLE,
          LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON,
          hljs.C_BLOCK_COMMENT_MODE,
          STRING,
          NUMBER,
          CONSTRUCTOR_CALL,
        ],
      };
      const FUNCTION_INVOKE = {
        relevance: 0,
        match: [
          /\b/,
          // to prevent keywords from being confused as the function title
          regex.concat("(?!fn\\b|function\\b|", normalizeKeywords(KWS).join("\\b|"), "|", normalizeKeywords(BUILT_INS).join("\\b|"), "\\b)"),
          IDENT_RE,
          regex.concat(WHITESPACE, "*"),
          regex.lookahead(/(?=\()/)
        ],
        scope: { 3: "title.function.invoke", },
        contains: [ PARAMS_MODE ]
      };
      PARAMS_MODE.contains.push(FUNCTION_INVOKE);

      const ATTRIBUTE_CONTAINS = [
        NAMED_ARGUMENT,
        LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON,
        hljs.C_BLOCK_COMMENT_MODE,
        STRING,
        NUMBER,
        CONSTRUCTOR_CALL,
      ];

      const ATTRIBUTES = {
        begin: regex.concat(/#\[\s*/, PASCAL_CASE_CLASS_NAME_RE),
        beginScope: "meta",
        end: /]/,
        endScope: "meta",
        keywords: {
          literal: LITERALS,
          keyword: [
            'new',
            'array',
          ]
        },
        contains: [
          {
            begin: /\[/,
            end: /]/,
            keywords: {
              literal: LITERALS,
              keyword: [
                'new',
                'array',
              ]
            },
            contains: [
              'self',
              ...ATTRIBUTE_CONTAINS,
            ]
          },
          ...ATTRIBUTE_CONTAINS,
          {
            scope: 'meta',
            match: PASCAL_CASE_CLASS_NAME_RE
          }
        ]
      };

      return {
        case_insensitive: false,
        keywords: KEYWORDS,
        contains: [
          ATTRIBUTES,
          hljs.HASH_COMMENT_MODE,
          hljs.COMMENT('//', '$'),
          hljs.COMMENT(
            '/\\*',
            '\\*/',
            { contains: [
              {
                scope: 'doctag',
                match: '@[A-Za-z]+'
              }
            ] }
          ),
          {
            match: /__halt_compiler\(\);/,
            keywords: '__halt_compiler',
            starts: {
              scope: "comment",
              end: hljs.MATCH_NOTHING_RE,
              contains: [
                {
                  match: /\?>/,
                  scope: "meta",
                  endsParent: true
                }
              ]
            }
          },
          PREPROCESSOR,
          {
            scope: 'variable.language',
            match: /\$this\b/
          },
          VARIABLE,
          FUNCTION_INVOKE,
          LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON,
          {
            match: [
              /const/,
              /\s/,
              IDENT_RE,
            ],
            scope: {
              1: "keyword",
              3: "variable.constant",
            },
          },
          CONSTRUCTOR_CALL,
          {
            scope: 'function',
            relevance: 0,
            beginKeywords: 'fn function',
            end: /[;{]/,
            excludeEnd: true,
            illegal: '[$%\\[]',
            contains: [
              { beginKeywords: 'use', },
              hljs.UNDERSCORE_TITLE_MODE,
              {
                begin: '=>', // No markup, just a relevance booster
                endsParent: true
              },
              {
                scope: 'params',
                begin: '\\(',
                end: '\\)',
                excludeBegin: true,
                excludeEnd: true,
                keywords: KEYWORDS,
                contains: [
                  'self',
                  VARIABLE,
                  LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON,
                  hljs.C_BLOCK_COMMENT_MODE,
                  STRING,
                  NUMBER
                ]
              },
            ]
          },
          {
            scope: 'class',
            variants: [
              {
                beginKeywords: "enum",
                illegal: /[($"]/
              },
              {
                beginKeywords: "class interface trait",
                illegal: /[:($"]/
              }
            ],
            relevance: 0,
            end: /\{/,
            excludeEnd: true,
            contains: [
              { beginKeywords: 'extends implements' },
              hljs.UNDERSCORE_TITLE_MODE
            ]
          },
          // both use and namespace still use "old style" rules (vs multi-match)
          // because the namespace name can include `\` and we still want each
          // element to be treated as its own *individual* title
          {
            beginKeywords: 'namespace',
            relevance: 0,
            end: ';',
            illegal: /[.']/,
            contains: [ hljs.inherit(hljs.UNDERSCORE_TITLE_MODE, { scope: "title.class" }) ]
          },
          {
            beginKeywords: 'use',
            relevance: 0,
            end: ';',
            contains: [
              // TODO: title.function vs title.class
              {
                match: /\b(as|const|function)\b/,
                scope: "keyword"
              },
              // TODO: could be title.class or title.function
              hljs.UNDERSCORE_TITLE_MODE
            ]
          },
          STRING,
          NUMBER,
        ]
      };
    }

    /*
    Language: Pony
    Author: Joe Eli McIlvain <joe.eli.mac@gmail.com>
    Description: Pony is an open-source, object-oriented, actor-model,
                 capabilities-secure, high performance programming language.
    Website: https://www.ponylang.io
    */

    function pony(hljs) {
      const KEYWORDS = {
        keyword:
          'actor addressof and as be break class compile_error compile_intrinsic '
          + 'consume continue delegate digestof do else elseif embed end error '
          + 'for fun if ifdef in interface is isnt lambda let match new not object '
          + 'or primitive recover repeat return struct then trait try type until '
          + 'use var where while with xor',
        meta:
          'iso val tag trn box ref',
        literal:
          'this false true'
      };

      const TRIPLE_QUOTE_STRING_MODE = {
        className: 'string',
        begin: '"""',
        end: '"""',
        relevance: 10
      };

      const QUOTE_STRING_MODE = {
        className: 'string',
        begin: '"',
        end: '"',
        contains: [ hljs.BACKSLASH_ESCAPE ]
      };

      const SINGLE_QUOTE_CHAR_MODE = {
        className: 'string',
        begin: '\'',
        end: '\'',
        contains: [ hljs.BACKSLASH_ESCAPE ],
        relevance: 0
      };

      const TYPE_NAME = {
        className: 'type',
        begin: '\\b_?[A-Z][\\w]*',
        relevance: 0
      };

      const PRIMED_NAME = {
        begin: hljs.IDENT_RE + '\'',
        relevance: 0
      };

      const NUMBER_MODE = {
        className: 'number',
        begin: '(-?)(\\b0[xX][a-fA-F0-9]+|\\b0[bB][01]+|(\\b\\d+(_\\d+)?(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)',
        relevance: 0
      };

      /**
       * The `FUNCTION` and `CLASS` modes were intentionally removed to simplify
       * highlighting and fix cases like
       * ```
       * interface Iterator[A: A]
       *   fun has_next(): Bool
       *   fun next(): A?
       * ```
       * where it is valid to have a function head without a body
       */

      return {
        name: 'Pony',
        keywords: KEYWORDS,
        contains: [
          TYPE_NAME,
          TRIPLE_QUOTE_STRING_MODE,
          QUOTE_STRING_MODE,
          SINGLE_QUOTE_CHAR_MODE,
          PRIMED_NAME,
          NUMBER_MODE,
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ]
      };
    }

    /*
    Language: PowerShell
    Description: PowerShell is a task-based command-line shell and scripting language built on .NET.
    Author: David Mohundro <david@mohundro.com>
    Contributors: Nicholas Blumhardt <nblumhardt@nblumhardt.com>, Victor Zhou <OiCMudkips@users.noreply.github.com>, Nicolas Le Gall <contact@nlegall.fr>
    Website: https://docs.microsoft.com/en-us/powershell/
    */

    function powershell(hljs) {
      const TYPES = [
        "string",
        "char",
        "byte",
        "int",
        "long",
        "bool",
        "decimal",
        "single",
        "double",
        "DateTime",
        "xml",
        "array",
        "hashtable",
        "void"
      ];

      // https://docs.microsoft.com/en-us/powershell/scripting/developer/cmdlet/approved-verbs-for-windows-powershell-commands
      const VALID_VERBS =
        'Add|Clear|Close|Copy|Enter|Exit|Find|Format|Get|Hide|Join|Lock|'
        + 'Move|New|Open|Optimize|Pop|Push|Redo|Remove|Rename|Reset|Resize|'
        + 'Search|Select|Set|Show|Skip|Split|Step|Switch|Undo|Unlock|'
        + 'Watch|Backup|Checkpoint|Compare|Compress|Convert|ConvertFrom|'
        + 'ConvertTo|Dismount|Edit|Expand|Export|Group|Import|Initialize|'
        + 'Limit|Merge|Mount|Out|Publish|Restore|Save|Sync|Unpublish|Update|'
        + 'Approve|Assert|Build|Complete|Confirm|Deny|Deploy|Disable|Enable|Install|Invoke|'
        + 'Register|Request|Restart|Resume|Start|Stop|Submit|Suspend|Uninstall|'
        + 'Unregister|Wait|Debug|Measure|Ping|Repair|Resolve|Test|Trace|Connect|'
        + 'Disconnect|Read|Receive|Send|Write|Block|Grant|Protect|Revoke|Unblock|'
        + 'Unprotect|Use|ForEach|Sort|Tee|Where';

      const COMPARISON_OPERATORS =
        '-and|-as|-band|-bnot|-bor|-bxor|-casesensitive|-ccontains|-ceq|-cge|-cgt|'
        + '-cle|-clike|-clt|-cmatch|-cne|-cnotcontains|-cnotlike|-cnotmatch|-contains|'
        + '-creplace|-csplit|-eq|-exact|-f|-file|-ge|-gt|-icontains|-ieq|-ige|-igt|'
        + '-ile|-ilike|-ilt|-imatch|-in|-ine|-inotcontains|-inotlike|-inotmatch|'
        + '-ireplace|-is|-isnot|-isplit|-join|-le|-like|-lt|-match|-ne|-not|'
        + '-notcontains|-notin|-notlike|-notmatch|-or|-regex|-replace|-shl|-shr|'
        + '-split|-wildcard|-xor';

      const KEYWORDS = {
        $pattern: /-?[A-z\.\-]+\b/,
        keyword:
          'if else foreach return do while until elseif begin for trap data dynamicparam '
          + 'end break throw param continue finally in switch exit filter try process catch '
          + 'hidden static parameter',
        // "echo" relevance has been set to 0 to avoid auto-detect conflicts with shell transcripts
        built_in:
          'ac asnp cat cd CFS chdir clc clear clhy cli clp cls clv cnsn compare copy cp '
          + 'cpi cpp curl cvpa dbp del diff dir dnsn ebp echo|0 epal epcsv epsn erase etsn exsn fc fhx '
          + 'fl ft fw gal gbp gc gcb gci gcm gcs gdr gerr ghy gi gin gjb gl gm gmo gp gps gpv group '
          + 'gsn gsnp gsv gtz gu gv gwmi h history icm iex ihy ii ipal ipcsv ipmo ipsn irm ise iwmi '
          + 'iwr kill lp ls man md measure mi mount move mp mv nal ndr ni nmo npssc nsn nv ogv oh '
          + 'popd ps pushd pwd r rbp rcjb rcsn rd rdr ren ri rjb rm rmdir rmo rni rnp rp rsn rsnp '
          + 'rujb rv rvpa rwmi sajb sal saps sasv sbp sc scb select set shcm si sl sleep sls sort sp '
          + 'spjb spps spsv start stz sujb sv swmi tee trcm type wget where wjb write'
        // TODO: 'validate[A-Z]+' can't work in keywords
      };

      const TITLE_NAME_RE = /\w[\w\d]*((-)[\w\d]+)*/;

      const BACKTICK_ESCAPE = {
        begin: '`[\\s\\S]',
        relevance: 0
      };

      const VAR = {
        className: 'variable',
        variants: [
          { begin: /\$\B/ },
          {
            className: 'keyword',
            begin: /\$this/
          },
          { begin: /\$[\w\d][\w\d_:]*/ }
        ]
      };

      const LITERAL = {
        className: 'literal',
        begin: /\$(null|true|false)\b/
      };

      const QUOTE_STRING = {
        className: "string",
        variants: [
          {
            begin: /"/,
            end: /"/
          },
          {
            begin: /@"/,
            end: /^"@/
          }
        ],
        contains: [
          BACKTICK_ESCAPE,
          VAR,
          {
            className: 'variable',
            begin: /\$[A-z]/,
            end: /[^A-z]/
          }
        ]
      };

      const APOS_STRING = {
        className: 'string',
        variants: [
          {
            begin: /'/,
            end: /'/
          },
          {
            begin: /@'/,
            end: /^'@/
          }
        ]
      };

      const PS_HELPTAGS = {
        className: "doctag",
        variants: [
          /* no paramater help tags */
          { begin: /\.(synopsis|description|example|inputs|outputs|notes|link|component|role|functionality)/ },
          /* one parameter help tags */
          { begin: /\.(parameter|forwardhelptargetname|forwardhelpcategory|remotehelprunspace|externalhelp)\s+\S+/ }
        ]
      };

      const PS_COMMENT = hljs.inherit(
        hljs.COMMENT(null, null),
        {
          variants: [
            /* single-line comment */
            {
              begin: /#/,
              end: /$/
            },
            /* multi-line comment */
            {
              begin: /<#/,
              end: /#>/
            }
          ],
          contains: [ PS_HELPTAGS ]
        }
      );

      const CMDLETS = {
        className: 'built_in',
        variants: [ { begin: '('.concat(VALID_VERBS, ')+(-)[\\w\\d]+') } ]
      };

      const PS_CLASS = {
        className: 'class',
        beginKeywords: 'class enum',
        end: /\s*[{]/,
        excludeEnd: true,
        relevance: 0,
        contains: [ hljs.TITLE_MODE ]
      };

      const PS_FUNCTION = {
        className: 'function',
        begin: /function\s+/,
        end: /\s*\{|$/,
        excludeEnd: true,
        returnBegin: true,
        relevance: 0,
        contains: [
          {
            begin: "function",
            relevance: 0,
            className: "keyword"
          },
          {
            className: "title",
            begin: TITLE_NAME_RE,
            relevance: 0
          },
          {
            begin: /\(/,
            end: /\)/,
            className: "params",
            relevance: 0,
            contains: [ VAR ]
          }
          // CMDLETS
        ]
      };

      // Using statment, plus type, plus assembly name.
      const PS_USING = {
        begin: /using\s/,
        end: /$/,
        returnBegin: true,
        contains: [
          QUOTE_STRING,
          APOS_STRING,
          {
            className: 'keyword',
            begin: /(using|assembly|command|module|namespace|type)/
          }
        ]
      };

      // Comperison operators & function named parameters.
      const PS_ARGUMENTS = { variants: [
        // PS literals are pretty verbose so it's a good idea to accent them a bit.
        {
          className: 'operator',
          begin: '('.concat(COMPARISON_OPERATORS, ')\\b')
        },
        {
          className: 'literal',
          begin: /(-){1,2}[\w\d-]+/,
          relevance: 0
        }
      ] };

      const HASH_SIGNS = {
        className: 'selector-tag',
        begin: /@\B/,
        relevance: 0
      };

      // It's a very general rule so I'll narrow it a bit with some strict boundaries
      // to avoid any possible false-positive collisions!
      const PS_METHODS = {
        className: 'function',
        begin: /\[.*\]\s*[\w]+[ ]??\(/,
        end: /$/,
        returnBegin: true,
        relevance: 0,
        contains: [
          {
            className: 'keyword',
            begin: '('.concat(
              KEYWORDS.keyword.toString().replace(/\s/g, '|'
              ), ')\\b'),
            endsParent: true,
            relevance: 0
          },
          hljs.inherit(hljs.TITLE_MODE, { endsParent: true })
        ]
      };

      const GENTLEMANS_SET = [
        // STATIC_MEMBER,
        PS_METHODS,
        PS_COMMENT,
        BACKTICK_ESCAPE,
        hljs.NUMBER_MODE,
        QUOTE_STRING,
        APOS_STRING,
        // PS_NEW_OBJECT_TYPE,
        CMDLETS,
        VAR,
        LITERAL,
        HASH_SIGNS
      ];

      const PS_TYPE = {
        begin: /\[/,
        end: /\]/,
        excludeBegin: true,
        excludeEnd: true,
        relevance: 0,
        contains: [].concat(
          'self',
          GENTLEMANS_SET,
          {
            begin: "(" + TYPES.join("|") + ")",
            className: "built_in",
            relevance: 0
          },
          {
            className: 'type',
            begin: /[\.\w\d]+/,
            relevance: 0
          }
        )
      };

      PS_METHODS.contains.unshift(PS_TYPE);

      return {
        name: 'PowerShell',
        aliases: [
          "pwsh",
          "ps",
          "ps1"
        ],
        case_insensitive: true,
        keywords: KEYWORDS,
        contains: GENTLEMANS_SET.concat(
          PS_CLASS,
          PS_FUNCTION,
          PS_USING,
          PS_ARGUMENTS,
          PS_TYPE
        )
      };
    }

    /*
    Language: Protocol Buffers
    Author: Dan Tao <daniel.tao@gmail.com>
    Description: Protocol buffer message definition format
    Website: https://developers.google.com/protocol-buffers/docs/proto3
    Category: protocols
    */

    function protobuf(hljs) {
      const KEYWORDS = [
        "package",
        "import",
        "option",
        "optional",
        "required",
        "repeated",
        "group",
        "oneof"
      ];
      const TYPES = [
        "double",
        "float",
        "int32",
        "int64",
        "uint32",
        "uint64",
        "sint32",
        "sint64",
        "fixed32",
        "fixed64",
        "sfixed32",
        "sfixed64",
        "bool",
        "string",
        "bytes"
      ];
      const CLASS_DEFINITION = {
        match: [
          /(message|enum|service)\s+/,
          hljs.IDENT_RE
        ],
        scope: {
          1: "keyword",
          2: "title.class"
        }
      };

      return {
        name: 'Protocol Buffers',
        keywords: {
          keyword: KEYWORDS,
          type: TYPES,
          literal: [
            'true',
            'false'
          ]
        },
        contains: [
          hljs.QUOTE_STRING_MODE,
          hljs.NUMBER_MODE,
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          CLASS_DEFINITION,
          {
            className: 'function',
            beginKeywords: 'rpc',
            end: /[{;]/,
            excludeEnd: true,
            keywords: 'rpc returns'
          },
          { // match enum items (relevance)
            // BLAH = ...;
            begin: /^\s*[A-Z_]+(?=\s*=[^\n]+;$)/ }
        ]
      };
    }

    /*
    Language: Python
    Description: Python is an interpreted, object-oriented, high-level programming language with dynamic semantics.
    Website: https://www.python.org
    Category: common
    */

    function python(hljs) {
      const regex = hljs.regex;
      const IDENT_RE = /[\p{XID_Start}_]\p{XID_Continue}*/u;
      const RESERVED_WORDS = [
        'and',
        'as',
        'assert',
        'async',
        'await',
        'break',
        'case',
        'class',
        'continue',
        'def',
        'del',
        'elif',
        'else',
        'except',
        'finally',
        'for',
        'from',
        'global',
        'if',
        'import',
        'in',
        'is',
        'lambda',
        'match',
        'nonlocal|10',
        'not',
        'or',
        'pass',
        'raise',
        'return',
        'try',
        'while',
        'with',
        'yield'
      ];

      const BUILT_INS = [
        '__import__',
        'abs',
        'all',
        'any',
        'ascii',
        'bin',
        'bool',
        'breakpoint',
        'bytearray',
        'bytes',
        'callable',
        'chr',
        'classmethod',
        'compile',
        'complex',
        'delattr',
        'dict',
        'dir',
        'divmod',
        'enumerate',
        'eval',
        'exec',
        'filter',
        'float',
        'format',
        'frozenset',
        'getattr',
        'globals',
        'hasattr',
        'hash',
        'help',
        'hex',
        'id',
        'input',
        'int',
        'isinstance',
        'issubclass',
        'iter',
        'len',
        'list',
        'locals',
        'map',
        'max',
        'memoryview',
        'min',
        'next',
        'object',
        'oct',
        'open',
        'ord',
        'pow',
        'print',
        'property',
        'range',
        'repr',
        'reversed',
        'round',
        'set',
        'setattr',
        'slice',
        'sorted',
        'staticmethod',
        'str',
        'sum',
        'super',
        'tuple',
        'type',
        'vars',
        'zip'
      ];

      const LITERALS = [
        '__debug__',
        'Ellipsis',
        'False',
        'None',
        'NotImplemented',
        'True'
      ];

      // https://docs.python.org/3/library/typing.html
      // TODO: Could these be supplemented by a CamelCase matcher in certain
      // contexts, leaving these remaining only for relevance hinting?
      const TYPES = [
        "Any",
        "Callable",
        "Coroutine",
        "Dict",
        "List",
        "Literal",
        "Generic",
        "Optional",
        "Sequence",
        "Set",
        "Tuple",
        "Type",
        "Union"
      ];

      const KEYWORDS = {
        $pattern: /[A-Za-z]\w+|__\w+__/,
        keyword: RESERVED_WORDS,
        built_in: BUILT_INS,
        literal: LITERALS,
        type: TYPES
      };

      const PROMPT = {
        className: 'meta',
        begin: /^(>>>|\.\.\.) /
      };

      const SUBST = {
        className: 'subst',
        begin: /\{/,
        end: /\}/,
        keywords: KEYWORDS,
        illegal: /#/
      };

      const LITERAL_BRACKET = {
        begin: /\{\{/,
        relevance: 0
      };

      const STRING = {
        className: 'string',
        contains: [ hljs.BACKSLASH_ESCAPE ],
        variants: [
          {
            begin: /([uU]|[bB]|[rR]|[bB][rR]|[rR][bB])?'''/,
            end: /'''/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              PROMPT
            ],
            relevance: 10
          },
          {
            begin: /([uU]|[bB]|[rR]|[bB][rR]|[rR][bB])?"""/,
            end: /"""/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              PROMPT
            ],
            relevance: 10
          },
          {
            begin: /([fF][rR]|[rR][fF]|[fF])'''/,
            end: /'''/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              PROMPT,
              LITERAL_BRACKET,
              SUBST
            ]
          },
          {
            begin: /([fF][rR]|[rR][fF]|[fF])"""/,
            end: /"""/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              PROMPT,
              LITERAL_BRACKET,
              SUBST
            ]
          },
          {
            begin: /([uU]|[rR])'/,
            end: /'/,
            relevance: 10
          },
          {
            begin: /([uU]|[rR])"/,
            end: /"/,
            relevance: 10
          },
          {
            begin: /([bB]|[bB][rR]|[rR][bB])'/,
            end: /'/
          },
          {
            begin: /([bB]|[bB][rR]|[rR][bB])"/,
            end: /"/
          },
          {
            begin: /([fF][rR]|[rR][fF]|[fF])'/,
            end: /'/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              LITERAL_BRACKET,
              SUBST
            ]
          },
          {
            begin: /([fF][rR]|[rR][fF]|[fF])"/,
            end: /"/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              LITERAL_BRACKET,
              SUBST
            ]
          },
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE
        ]
      };

      // https://docs.python.org/3.9/reference/lexical_analysis.html#numeric-literals
      const digitpart = '[0-9](_?[0-9])*';
      const pointfloat = `(\\b(${digitpart}))?\\.(${digitpart})|\\b(${digitpart})\\.`;
      // Whitespace after a number (or any lexical token) is needed only if its absence
      // would change the tokenization
      // https://docs.python.org/3.9/reference/lexical_analysis.html#whitespace-between-tokens
      // We deviate slightly, requiring a word boundary or a keyword
      // to avoid accidentally recognizing *prefixes* (e.g., `0` in `0x41` or `08` or `0__1`)
      const lookahead = `\\b|${RESERVED_WORDS.join('|')}`;
      const NUMBER = {
        className: 'number',
        relevance: 0,
        variants: [
          // exponentfloat, pointfloat
          // https://docs.python.org/3.9/reference/lexical_analysis.html#floating-point-literals
          // optionally imaginary
          // https://docs.python.org/3.9/reference/lexical_analysis.html#imaginary-literals
          // Note: no leading \b because floats can start with a decimal point
          // and we don't want to mishandle e.g. `fn(.5)`,
          // no trailing \b for pointfloat because it can end with a decimal point
          // and we don't want to mishandle e.g. `0..hex()`; this should be safe
          // because both MUST contain a decimal point and so cannot be confused with
          // the interior part of an identifier
          {
            begin: `(\\b(${digitpart})|(${pointfloat}))[eE][+-]?(${digitpart})[jJ]?(?=${lookahead})`
          },
          {
            begin: `(${pointfloat})[jJ]?`
          },

          // decinteger, bininteger, octinteger, hexinteger
          // https://docs.python.org/3.9/reference/lexical_analysis.html#integer-literals
          // optionally "long" in Python 2
          // https://docs.python.org/2.7/reference/lexical_analysis.html#integer-and-long-integer-literals
          // decinteger is optionally imaginary
          // https://docs.python.org/3.9/reference/lexical_analysis.html#imaginary-literals
          {
            begin: `\\b([1-9](_?[0-9])*|0+(_?0)*)[lLjJ]?(?=${lookahead})`
          },
          {
            begin: `\\b0[bB](_?[01])+[lL]?(?=${lookahead})`
          },
          {
            begin: `\\b0[oO](_?[0-7])+[lL]?(?=${lookahead})`
          },
          {
            begin: `\\b0[xX](_?[0-9a-fA-F])+[lL]?(?=${lookahead})`
          },

          // imagnumber (digitpart-based)
          // https://docs.python.org/3.9/reference/lexical_analysis.html#imaginary-literals
          {
            begin: `\\b(${digitpart})[jJ](?=${lookahead})`
          }
        ]
      };
      const COMMENT_TYPE = {
        className: "comment",
        begin: regex.lookahead(/# type:/),
        end: /$/,
        keywords: KEYWORDS,
        contains: [
          { // prevent keywords from coloring `type`
            begin: /# type:/
          },
          // comment within a datatype comment includes no keywords
          {
            begin: /#/,
            end: /\b\B/,
            endsWithParent: true
          }
        ]
      };
      const PARAMS = {
        className: 'params',
        variants: [
          // Exclude params in functions without params
          {
            className: "",
            begin: /\(\s*\)/,
            skip: true
          },
          {
            begin: /\(/,
            end: /\)/,
            excludeBegin: true,
            excludeEnd: true,
            keywords: KEYWORDS,
            contains: [
              'self',
              PROMPT,
              NUMBER,
              STRING,
              hljs.HASH_COMMENT_MODE
            ]
          }
        ]
      };
      SUBST.contains = [
        STRING,
        NUMBER,
        PROMPT
      ];

      return {
        name: 'Python',
        aliases: [
          'py',
          'gyp',
          'ipython'
        ],
        unicodeRegex: true,
        keywords: KEYWORDS,
        illegal: /(<\/|->|\?)|=>/,
        contains: [
          PROMPT,
          NUMBER,
          {
            // very common convention
            begin: /\bself\b/
          },
          {
            // eat "if" prior to string so that it won't accidentally be
            // labeled as an f-string
            beginKeywords: "if",
            relevance: 0
          },
          STRING,
          COMMENT_TYPE,
          hljs.HASH_COMMENT_MODE,
          {
            match: [
              /\bdef/, /\s+/,
              IDENT_RE,
            ],
            scope: {
              1: "keyword",
              3: "title.function"
            },
            contains: [ PARAMS ]
          },
          {
            variants: [
              {
                match: [
                  /\bclass/, /\s+/,
                  IDENT_RE, /\s*/,
                  /\(\s*/, IDENT_RE,/\s*\)/
                ],
              },
              {
                match: [
                  /\bclass/, /\s+/,
                  IDENT_RE
                ],
              }
            ],
            scope: {
              1: "keyword",
              3: "title.class",
              6: "title.class.inherited",
            }
          },
          {
            className: 'meta',
            begin: /^[\t ]*@/,
            end: /(?=#)|$/,
            contains: [
              NUMBER,
              PARAMS,
              STRING
            ]
          }
        ]
      };
    }

    /*
    Language: Ruby
    Description: Ruby is a dynamic, open source programming language with a focus on simplicity and productivity.
    Website: https://www.ruby-lang.org/
    Author: Anton Kovalyov <anton@kovalyov.net>
    Contributors: Peter Leonov <gojpeg@yandex.ru>, Vasily Polovnyov <vast@whiteants.net>, Loren Segal <lsegal@soen.ca>, Pascal Hurni <phi@ruby-reactive.org>, Cedric Sohrauer <sohrauer@googlemail.com>
    Category: common
    */

    function ruby(hljs) {
      const regex = hljs.regex;
      const RUBY_METHOD_RE = '([a-zA-Z_]\\w*[!?=]?|[-+~]@|<<|>>|=~|===?|<=>|[<>]=?|\\*\\*|[-/+%^&*~`|]|\\[\\]=?)';
      // TODO: move concepts like CAMEL_CASE into `modes.js`
      const CLASS_NAME_RE = regex.either(
        /\b([A-Z]+[a-z0-9]+)+/,
        // ends in caps
        /\b([A-Z]+[a-z0-9]+)+[A-Z]+/,
      )
      ;
      const CLASS_NAME_WITH_NAMESPACE_RE = regex.concat(CLASS_NAME_RE, /(::\w+)*/);
      // very popular ruby built-ins that one might even assume
      // are actual keywords (despite that not being the case)
      const PSEUDO_KWS = [
        "include",
        "extend",
        "prepend",
        "public",
        "private",
        "protected",
        "raise",
        "throw"
      ];
      const RUBY_KEYWORDS = {
        "variable.constant": [
          "__FILE__",
          "__LINE__",
          "__ENCODING__"
        ],
        "variable.language": [
          "self",
          "super",
        ],
        keyword: [
          "alias",
          "and",
          "begin",
          "BEGIN",
          "break",
          "case",
          "class",
          "defined",
          "do",
          "else",
          "elsif",
          "end",
          "END",
          "ensure",
          "for",
          "if",
          "in",
          "module",
          "next",
          "not",
          "or",
          "redo",
          "require",
          "rescue",
          "retry",
          "return",
          "then",
          "undef",
          "unless",
          "until",
          "when",
          "while",
          "yield",
          ...PSEUDO_KWS
        ],
        built_in: [
          "proc",
          "lambda",
          "attr_accessor",
          "attr_reader",
          "attr_writer",
          "define_method",
          "private_constant",
          "module_function"
        ],
        literal: [
          "true",
          "false",
          "nil"
        ]
      };
      const YARDOCTAG = {
        className: 'doctag',
        begin: '@[A-Za-z]+'
      };
      const IRB_OBJECT = {
        begin: '#<',
        end: '>'
      };
      const COMMENT_MODES = [
        hljs.COMMENT(
          '#',
          '$',
          { contains: [ YARDOCTAG ] }
        ),
        hljs.COMMENT(
          '^=begin',
          '^=end',
          {
            contains: [ YARDOCTAG ],
            relevance: 10
          }
        ),
        hljs.COMMENT('^__END__', hljs.MATCH_NOTHING_RE)
      ];
      const SUBST = {
        className: 'subst',
        begin: /#\{/,
        end: /\}/,
        keywords: RUBY_KEYWORDS
      };
      const STRING = {
        className: 'string',
        contains: [
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ],
        variants: [
          {
            begin: /'/,
            end: /'/
          },
          {
            begin: /"/,
            end: /"/
          },
          {
            begin: /`/,
            end: /`/
          },
          {
            begin: /%[qQwWx]?\(/,
            end: /\)/
          },
          {
            begin: /%[qQwWx]?\[/,
            end: /\]/
          },
          {
            begin: /%[qQwWx]?\{/,
            end: /\}/
          },
          {
            begin: /%[qQwWx]?</,
            end: />/
          },
          {
            begin: /%[qQwWx]?\//,
            end: /\//
          },
          {
            begin: /%[qQwWx]?%/,
            end: /%/
          },
          {
            begin: /%[qQwWx]?-/,
            end: /-/
          },
          {
            begin: /%[qQwWx]?\|/,
            end: /\|/
          },
          // in the following expressions, \B in the beginning suppresses recognition of ?-sequences
          // where ? is the last character of a preceding identifier, as in: `func?4`
          { begin: /\B\?(\\\d{1,3})/ },
          { begin: /\B\?(\\x[A-Fa-f0-9]{1,2})/ },
          { begin: /\B\?(\\u\{?[A-Fa-f0-9]{1,6}\}?)/ },
          { begin: /\B\?(\\M-\\C-|\\M-\\c|\\c\\M-|\\M-|\\C-\\M-)[\x20-\x7e]/ },
          { begin: /\B\?\\(c|C-)[\x20-\x7e]/ },
          { begin: /\B\?\\?\S/ },
          // heredocs
          {
            // this guard makes sure that we have an entire heredoc and not a false
            // positive (auto-detect, etc.)
            begin: regex.concat(
              /<<[-~]?'?/,
              regex.lookahead(/(\w+)(?=\W)[^\n]*\n(?:[^\n]*\n)*?\s*\1\b/)
            ),
            contains: [
              hljs.END_SAME_AS_BEGIN({
                begin: /(\w+)/,
                end: /(\w+)/,
                contains: [
                  hljs.BACKSLASH_ESCAPE,
                  SUBST
                ]
              })
            ]
          }
        ]
      };

      // Ruby syntax is underdocumented, but this grammar seems to be accurate
      // as of version 2.7.2 (confirmed with (irb and `Ripper.sexp(...)`)
      // https://docs.ruby-lang.org/en/2.7.0/doc/syntax/literals_rdoc.html#label-Numbers
      const decimal = '[1-9](_?[0-9])*|0';
      const digits = '[0-9](_?[0-9])*';
      const NUMBER = {
        className: 'number',
        relevance: 0,
        variants: [
          // decimal integer/float, optionally exponential or rational, optionally imaginary
          { begin: `\\b(${decimal})(\\.(${digits}))?([eE][+-]?(${digits})|r)?i?\\b` },

          // explicit decimal/binary/octal/hexadecimal integer,
          // optionally rational and/or imaginary
          { begin: "\\b0[dD][0-9](_?[0-9])*r?i?\\b" },
          { begin: "\\b0[bB][0-1](_?[0-1])*r?i?\\b" },
          { begin: "\\b0[oO][0-7](_?[0-7])*r?i?\\b" },
          { begin: "\\b0[xX][0-9a-fA-F](_?[0-9a-fA-F])*r?i?\\b" },

          // 0-prefixed implicit octal integer, optionally rational and/or imaginary
          { begin: "\\b0(_?[0-7])+r?i?\\b" }
        ]
      };

      const PARAMS = {
        variants: [
          {
            match: /\(\)/,
          },
          {
            className: 'params',
            begin: /\(/,
            end: /(?=\))/,
            excludeBegin: true,
            endsParent: true,
            keywords: RUBY_KEYWORDS,
          }
        ]
      };

      const INCLUDE_EXTEND = {
        match: [
          /(include|extend)\s+/,
          CLASS_NAME_WITH_NAMESPACE_RE
        ],
        scope: {
          2: "title.class"
        },
        keywords: RUBY_KEYWORDS
      };

      const CLASS_DEFINITION = {
        variants: [
          {
            match: [
              /class\s+/,
              CLASS_NAME_WITH_NAMESPACE_RE,
              /\s+<\s+/,
              CLASS_NAME_WITH_NAMESPACE_RE
            ]
          },
          {
            match: [
              /\b(class|module)\s+/,
              CLASS_NAME_WITH_NAMESPACE_RE
            ]
          }
        ],
        scope: {
          2: "title.class",
          4: "title.class.inherited"
        },
        keywords: RUBY_KEYWORDS
      };

      const UPPER_CASE_CONSTANT = {
        relevance: 0,
        match: /\b[A-Z][A-Z_0-9]+\b/,
        className: "variable.constant"
      };

      const METHOD_DEFINITION = {
        match: [
          /def/, /\s+/,
          RUBY_METHOD_RE
        ],
        scope: {
          1: "keyword",
          3: "title.function"
        },
        contains: [
          PARAMS
        ]
      };

      const OBJECT_CREATION = {
        relevance: 0,
        match: [
          CLASS_NAME_WITH_NAMESPACE_RE,
          /\.new[. (]/
        ],
        scope: {
          1: "title.class"
        }
      };

      // CamelCase
      const CLASS_REFERENCE = {
        relevance: 0,
        match: CLASS_NAME_RE,
        scope: "title.class"
      };

      const RUBY_DEFAULT_CONTAINS = [
        STRING,
        CLASS_DEFINITION,
        INCLUDE_EXTEND,
        OBJECT_CREATION,
        UPPER_CASE_CONSTANT,
        CLASS_REFERENCE,
        METHOD_DEFINITION,
        {
          // swallow namespace qualifiers before symbols
          begin: hljs.IDENT_RE + '::' },
        {
          className: 'symbol',
          begin: hljs.UNDERSCORE_IDENT_RE + '(!|\\?)?:',
          relevance: 0
        },
        {
          className: 'symbol',
          begin: ':(?!\\s)',
          contains: [
            STRING,
            { begin: RUBY_METHOD_RE }
          ],
          relevance: 0
        },
        NUMBER,
        {
          // negative-look forward attempts to prevent false matches like:
          // @ident@ or $ident$ that might indicate this is not ruby at all
          className: "variable",
          begin: '(\\$\\W)|((\\$|@@?)(\\w+))(?=[^@$?])' + `(?![A-Za-z])(?![@$?'])`
        },
        {
          className: 'params',
          begin: /\|/,
          end: /\|/,
          excludeBegin: true,
          excludeEnd: true,
          relevance: 0, // this could be a lot of things (in other languages) other than params
          keywords: RUBY_KEYWORDS
        },
        { // regexp container
          begin: '(' + hljs.RE_STARTERS_RE + '|unless)\\s*',
          keywords: 'unless',
          contains: [
            {
              className: 'regexp',
              contains: [
                hljs.BACKSLASH_ESCAPE,
                SUBST
              ],
              illegal: /\n/,
              variants: [
                {
                  begin: '/',
                  end: '/[a-z]*'
                },
                {
                  begin: /%r\{/,
                  end: /\}[a-z]*/
                },
                {
                  begin: '%r\\(',
                  end: '\\)[a-z]*'
                },
                {
                  begin: '%r!',
                  end: '![a-z]*'
                },
                {
                  begin: '%r\\[',
                  end: '\\][a-z]*'
                }
              ]
            }
          ].concat(IRB_OBJECT, COMMENT_MODES),
          relevance: 0
        }
      ].concat(IRB_OBJECT, COMMENT_MODES);

      SUBST.contains = RUBY_DEFAULT_CONTAINS;
      PARAMS.contains = RUBY_DEFAULT_CONTAINS;

      // >>
      // ?>
      const SIMPLE_PROMPT = "[>?]>";
      // irb(main):001:0>
      const DEFAULT_PROMPT = "[\\w#]+\\(\\w+\\):\\d+:\\d+[>*]";
      const RVM_PROMPT = "(\\w+-)?\\d+\\.\\d+\\.\\d+(p\\d+)?[^\\d][^>]+>";

      const IRB_DEFAULT = [
        {
          begin: /^\s*=>/,
          starts: {
            end: '$',
            contains: RUBY_DEFAULT_CONTAINS
          }
        },
        {
          className: 'meta.prompt',
          begin: '^(' + SIMPLE_PROMPT + "|" + DEFAULT_PROMPT + '|' + RVM_PROMPT + ')(?=[ ])',
          starts: {
            end: '$',
            keywords: RUBY_KEYWORDS,
            contains: RUBY_DEFAULT_CONTAINS
          }
        }
      ];

      COMMENT_MODES.unshift(IRB_OBJECT);

      return {
        name: 'Ruby',
        aliases: [
          'rb',
          'gemspec',
          'podspec',
          'thor',
          'irb'
        ],
        keywords: RUBY_KEYWORDS,
        illegal: /\/\*/,
        contains: [ hljs.SHEBANG({ binary: "ruby" }) ]
          .concat(IRB_DEFAULT)
          .concat(COMMENT_MODES)
          .concat(RUBY_DEFAULT_CONTAINS)
      };
    }

    /*
    Language: Rust
    Author: Andrey Vlasovskikh <andrey.vlasovskikh@gmail.com>
    Contributors: Roman Shmatov <romanshmatov@gmail.com>, Kasper Andersen <kma_untrusted@protonmail.com>
    Website: https://www.rust-lang.org
    Category: common, system
    */

    /** @type LanguageFn */
    function rust(hljs) {
      const regex = hljs.regex;
      const FUNCTION_INVOKE = {
        className: "title.function.invoke",
        relevance: 0,
        begin: regex.concat(
          /\b/,
          /(?!let\b)/,
          hljs.IDENT_RE,
          regex.lookahead(/\s*\(/))
      };
      const NUMBER_SUFFIX = '([ui](8|16|32|64|128|size)|f(32|64))\?';
      const KEYWORDS = [
        "abstract",
        "as",
        "async",
        "await",
        "become",
        "box",
        "break",
        "const",
        "continue",
        "crate",
        "do",
        "dyn",
        "else",
        "enum",
        "extern",
        "false",
        "final",
        "fn",
        "for",
        "if",
        "impl",
        "in",
        "let",
        "loop",
        "macro",
        "match",
        "mod",
        "move",
        "mut",
        "override",
        "priv",
        "pub",
        "ref",
        "return",
        "self",
        "Self",
        "static",
        "struct",
        "super",
        "trait",
        "true",
        "try",
        "type",
        "typeof",
        "unsafe",
        "unsized",
        "use",
        "virtual",
        "where",
        "while",
        "yield"
      ];
      const LITERALS = [
        "true",
        "false",
        "Some",
        "None",
        "Ok",
        "Err"
      ];
      const BUILTINS = [
        // functions
        'drop ',
        // traits
        "Copy",
        "Send",
        "Sized",
        "Sync",
        "Drop",
        "Fn",
        "FnMut",
        "FnOnce",
        "ToOwned",
        "Clone",
        "Debug",
        "PartialEq",
        "PartialOrd",
        "Eq",
        "Ord",
        "AsRef",
        "AsMut",
        "Into",
        "From",
        "Default",
        "Iterator",
        "Extend",
        "IntoIterator",
        "DoubleEndedIterator",
        "ExactSizeIterator",
        "SliceConcatExt",
        "ToString",
        // macros
        "assert!",
        "assert_eq!",
        "bitflags!",
        "bytes!",
        "cfg!",
        "col!",
        "concat!",
        "concat_idents!",
        "debug_assert!",
        "debug_assert_eq!",
        "env!",
        "panic!",
        "file!",
        "format!",
        "format_args!",
        "include_bytes!",
        "include_str!",
        "line!",
        "local_data_key!",
        "module_path!",
        "option_env!",
        "print!",
        "println!",
        "select!",
        "stringify!",
        "try!",
        "unimplemented!",
        "unreachable!",
        "vec!",
        "write!",
        "writeln!",
        "macro_rules!",
        "assert_ne!",
        "debug_assert_ne!"
      ];
      const TYPES = [
        "i8",
        "i16",
        "i32",
        "i64",
        "i128",
        "isize",
        "u8",
        "u16",
        "u32",
        "u64",
        "u128",
        "usize",
        "f32",
        "f64",
        "str",
        "char",
        "bool",
        "Box",
        "Option",
        "Result",
        "String",
        "Vec"
      ];
      return {
        name: 'Rust',
        aliases: [ 'rs' ],
        keywords: {
          $pattern: hljs.IDENT_RE + '!?',
          type: TYPES,
          keyword: KEYWORDS,
          literal: LITERALS,
          built_in: BUILTINS
        },
        illegal: '</',
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.COMMENT('/\\*', '\\*/', { contains: [ 'self' ] }),
          hljs.inherit(hljs.QUOTE_STRING_MODE, {
            begin: /b?"/,
            illegal: null
          }),
          {
            className: 'string',
            variants: [
              { begin: /b?r(#*)"(.|\n)*?"\1(?!#)/ },
              { begin: /b?'\\?(x\w{2}|u\w{4}|U\w{8}|.)'/ }
            ]
          },
          {
            className: 'symbol',
            begin: /'[a-zA-Z_][a-zA-Z0-9_]*/
          },
          {
            className: 'number',
            variants: [
              { begin: '\\b0b([01_]+)' + NUMBER_SUFFIX },
              { begin: '\\b0o([0-7_]+)' + NUMBER_SUFFIX },
              { begin: '\\b0x([A-Fa-f0-9_]+)' + NUMBER_SUFFIX },
              { begin: '\\b(\\d[\\d_]*(\\.[0-9_]+)?([eE][+-]?[0-9_]+)?)'
                       + NUMBER_SUFFIX }
            ],
            relevance: 0
          },
          {
            begin: [
              /fn/,
              /\s+/,
              hljs.UNDERSCORE_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "title.function"
            }
          },
          {
            className: 'meta',
            begin: '#!?\\[',
            end: '\\]',
            contains: [
              {
                className: 'string',
                begin: /"/,
                end: /"/
              }
            ]
          },
          {
            begin: [
              /let/,
              /\s+/,
              /(?:mut\s+)?/,
              hljs.UNDERSCORE_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "keyword",
              4: "variable"
            }
          },
          // must come before impl/for rule later
          {
            begin: [
              /for/,
              /\s+/,
              hljs.UNDERSCORE_IDENT_RE,
              /\s+/,
              /in/
            ],
            className: {
              1: "keyword",
              3: "variable",
              5: "keyword"
            }
          },
          {
            begin: [
              /type/,
              /\s+/,
              hljs.UNDERSCORE_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "title.class"
            }
          },
          {
            begin: [
              /(?:trait|enum|struct|union|impl|for)/,
              /\s+/,
              hljs.UNDERSCORE_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "title.class"
            }
          },
          {
            begin: hljs.IDENT_RE + '::',
            keywords: {
              keyword: "Self",
              built_in: BUILTINS,
              type: TYPES
            }
          },
          {
            className: "punctuation",
            begin: '->'
          },
          FUNCTION_INVOKE
        ]
      };
    }

    /*
    Language: Scala
    Category: functional
    Author: Jan Berkel <jan.berkel@gmail.com>
    Contributors: Erik Osheim <d_m@plastic-idolatry.com>
    Website: https://www.scala-lang.org
    */

    function scala(hljs) {
      const regex = hljs.regex;
      const ANNOTATION = {
        className: 'meta',
        begin: '@[A-Za-z]+'
      };

      // used in strings for escaping/interpolation/substitution
      const SUBST = {
        className: 'subst',
        variants: [
          { begin: '\\$[A-Za-z0-9_]+' },
          {
            begin: /\$\{/,
            end: /\}/
          }
        ]
      };

      const STRING = {
        className: 'string',
        variants: [
          {
            begin: '"""',
            end: '"""'
          },
          {
            begin: '"',
            end: '"',
            illegal: '\\n',
            contains: [ hljs.BACKSLASH_ESCAPE ]
          },
          {
            begin: '[a-z]+"',
            end: '"',
            illegal: '\\n',
            contains: [
              hljs.BACKSLASH_ESCAPE,
              SUBST
            ]
          },
          {
            className: 'string',
            begin: '[a-z]+"""',
            end: '"""',
            contains: [ SUBST ],
            relevance: 10
          }
        ]

      };

      const TYPE = {
        className: 'type',
        begin: '\\b[A-Z][A-Za-z0-9_]*',
        relevance: 0
      };

      const NAME = {
        className: 'title',
        begin: /[^0-9\n\t "'(),.`{}\[\]:;][^\n\t "'(),.`{}\[\]:;]+|[^0-9\n\t "'(),.`{}\[\]:;=]/,
        relevance: 0
      };

      const CLASS = {
        className: 'class',
        beginKeywords: 'class object trait type',
        end: /[:={\[\n;]/,
        excludeEnd: true,
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          {
            beginKeywords: 'extends with',
            relevance: 10
          },
          {
            begin: /\[/,
            end: /\]/,
            excludeBegin: true,
            excludeEnd: true,
            relevance: 0,
            contains: [ TYPE ]
          },
          {
            className: 'params',
            begin: /\(/,
            end: /\)/,
            excludeBegin: true,
            excludeEnd: true,
            relevance: 0,
            contains: [ TYPE ]
          },
          NAME
        ]
      };

      const METHOD = {
        className: 'function',
        beginKeywords: 'def',
        end: regex.lookahead(/[:={\[(\n;]/),
        contains: [ NAME ]
      };

      const EXTENSION = {
        begin: [
          /^\s*/, // Is first token on the line
          'extension',
          /\s+(?=[[(])/, // followed by at least one space and `[` or `(`
        ],
        beginScope: { 2: "keyword", }
      };

      const END = {
        begin: [
          /^\s*/, // Is first token on the line
          /end/,
          /\s+/,
          /(extension\b)?/, // `extension` is the only marker that follows an `end` that cannot be captured by another rule.
        ],
        beginScope: {
          2: "keyword",
          4: "keyword",
        }
      };

      // TODO: use negative look-behind in future
      //       /(?<!\.)\binline(?=\s)/
      const INLINE_MODES = [
        { match: /\.inline\b/ },
        {
          begin: /\binline(?=\s)/,
          keywords: 'inline'
        }
      ];

      const USING_PARAM_CLAUSE = {
        begin: [
          /\(\s*/, // Opening `(` of a parameter or argument list
          /using/,
          /\s+(?!\))/, // Spaces not followed by `)`
        ],
        beginScope: { 2: "keyword", }
      };

      return {
        name: 'Scala',
        keywords: {
          literal: 'true false null',
          keyword: 'type yield lazy override def with val var sealed abstract private trait object if then forSome for while do throw finally protected extends import final return else break new catch super class case package default try this match continue throws implicit export enum given transparent'
        },
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          STRING,
          TYPE,
          METHOD,
          CLASS,
          hljs.C_NUMBER_MODE,
          EXTENSION,
          END,
          ...INLINE_MODES,
          USING_PARAM_CLAUSE,
          ANNOTATION
        ]
      };
    }

    /*
    Language: Scheme
    Description: Scheme is a programming language in the Lisp family.
                 (keywords based on http://community.schemewiki.org/?scheme-keywords)
    Author: JP Verkamp <me@jverkamp.com>
    Contributors: Ivan Sagalaev <maniac@softwaremaniacs.org>
    Origin: clojure.js
    Website: http://community.schemewiki.org/?what-is-scheme
    Category: lisp
    */

    function scheme(hljs) {
      const SCHEME_IDENT_RE = '[^\\(\\)\\[\\]\\{\\}",\'`;#|\\\\\\s]+';
      const SCHEME_SIMPLE_NUMBER_RE = '(-|\\+)?\\d+([./]\\d+)?';
      const SCHEME_COMPLEX_NUMBER_RE = SCHEME_SIMPLE_NUMBER_RE + '[+\\-]' + SCHEME_SIMPLE_NUMBER_RE + 'i';
      const KEYWORDS = {
        $pattern: SCHEME_IDENT_RE,
        built_in:
          'case-lambda call/cc class define-class exit-handler field import '
          + 'inherit init-field interface let*-values let-values let/ec mixin '
          + 'opt-lambda override protect provide public rename require '
          + 'require-for-syntax syntax syntax-case syntax-error unit/sig unless '
          + 'when with-syntax and begin call-with-current-continuation '
          + 'call-with-input-file call-with-output-file case cond define '
          + 'define-syntax delay do dynamic-wind else for-each if lambda let let* '
          + 'let-syntax letrec letrec-syntax map or syntax-rules \' * + , ,@ - ... / '
          + '; < <= = => > >= ` abs acos angle append apply asin assoc assq assv atan '
          + 'boolean? caar cadr call-with-input-file call-with-output-file '
          + 'call-with-values car cdddar cddddr cdr ceiling char->integer '
          + 'char-alphabetic? char-ci<=? char-ci<? char-ci=? char-ci>=? char-ci>? '
          + 'char-downcase char-lower-case? char-numeric? char-ready? char-upcase '
          + 'char-upper-case? char-whitespace? char<=? char<? char=? char>=? char>? '
          + 'char? close-input-port close-output-port complex? cons cos '
          + 'current-input-port current-output-port denominator display eof-object? '
          + 'eq? equal? eqv? eval even? exact->inexact exact? exp expt floor '
          + 'force gcd imag-part inexact->exact inexact? input-port? integer->char '
          + 'integer? interaction-environment lcm length list list->string '
          + 'list->vector list-ref list-tail list? load log magnitude make-polar '
          + 'make-rectangular make-string make-vector max member memq memv min '
          + 'modulo negative? newline not null-environment null? number->string '
          + 'number? numerator odd? open-input-file open-output-file output-port? '
          + 'pair? peek-char port? positive? procedure? quasiquote quote quotient '
          + 'rational? rationalize read read-char real-part real? remainder reverse '
          + 'round scheme-report-environment set! set-car! set-cdr! sin sqrt string '
          + 'string->list string->number string->symbol string-append string-ci<=? '
          + 'string-ci<? string-ci=? string-ci>=? string-ci>? string-copy '
          + 'string-fill! string-length string-ref string-set! string<=? string<? '
          + 'string=? string>=? string>? string? substring symbol->string symbol? '
          + 'tan transcript-off transcript-on truncate values vector '
          + 'vector->list vector-fill! vector-length vector-ref vector-set! '
          + 'with-input-from-file with-output-to-file write write-char zero?'
      };

      const LITERAL = {
        className: 'literal',
        begin: '(#t|#f|#\\\\' + SCHEME_IDENT_RE + '|#\\\\.)'
      };

      const NUMBER = {
        className: 'number',
        variants: [
          {
            begin: SCHEME_SIMPLE_NUMBER_RE,
            relevance: 0
          },
          {
            begin: SCHEME_COMPLEX_NUMBER_RE,
            relevance: 0
          },
          { begin: '#b[0-1]+(/[0-1]+)?' },
          { begin: '#o[0-7]+(/[0-7]+)?' },
          { begin: '#x[0-9a-f]+(/[0-9a-f]+)?' }
        ]
      };

      const STRING = hljs.QUOTE_STRING_MODE;

      const COMMENT_MODES = [
        hljs.COMMENT(
          ';',
          '$',
          { relevance: 0 }
        ),
        hljs.COMMENT('#\\|', '\\|#')
      ];

      const IDENT = {
        begin: SCHEME_IDENT_RE,
        relevance: 0
      };

      const QUOTED_IDENT = {
        className: 'symbol',
        begin: '\'' + SCHEME_IDENT_RE
      };

      const BODY = {
        endsWithParent: true,
        relevance: 0
      };

      const QUOTED_LIST = {
        variants: [
          { begin: /'/ },
          { begin: '`' }
        ],
        contains: [
          {
            begin: '\\(',
            end: '\\)',
            contains: [
              'self',
              LITERAL,
              STRING,
              NUMBER,
              IDENT,
              QUOTED_IDENT
            ]
          }
        ]
      };

      const NAME = {
        className: 'name',
        relevance: 0,
        begin: SCHEME_IDENT_RE,
        keywords: KEYWORDS
      };

      const LAMBDA = {
        begin: /lambda/,
        endsWithParent: true,
        returnBegin: true,
        contains: [
          NAME,
          {
            endsParent: true,
            variants: [
              {
                begin: /\(/,
                end: /\)/
              },
              {
                begin: /\[/,
                end: /\]/
              }
            ],
            contains: [ IDENT ]
          }
        ]
      };

      const LIST = {
        variants: [
          {
            begin: '\\(',
            end: '\\)'
          },
          {
            begin: '\\[',
            end: '\\]'
          }
        ],
        contains: [
          LAMBDA,
          NAME,
          BODY
        ]
      };

      BODY.contains = [
        LITERAL,
        NUMBER,
        STRING,
        IDENT,
        QUOTED_IDENT,
        QUOTED_LIST,
        LIST
      ].concat(COMMENT_MODES);

      return {
        name: 'Scheme',
        aliases: ['scm'],
        illegal: /\S/,
        contains: [
          hljs.SHEBANG(),
          NUMBER,
          STRING,
          QUOTED_IDENT,
          QUOTED_LIST,
          LIST
        ].concat(COMMENT_MODES)
      };
    }

    /*
    Language: SCSS
    Description: Scss is an extension of the syntax of CSS.
    Author: Kurt Emch <kurt@kurtemch.com>
    Website: https://sass-lang.com
    Category: common, css, web
    */

    /** @type LanguageFn */
    function scss(hljs) {
      const modes = MODES(hljs);
      const PSEUDO_ELEMENTS$1 = PSEUDO_ELEMENTS;
      const PSEUDO_CLASSES$1 = PSEUDO_CLASSES;

      const AT_IDENTIFIER = '@[a-z-]+'; // @font-face
      const AT_MODIFIERS = "and or not only";
      const IDENT_RE = '[a-zA-Z-][a-zA-Z0-9_-]*';
      const VARIABLE = {
        className: 'variable',
        begin: '(\\$' + IDENT_RE + ')\\b',
        relevance: 0
      };

      return {
        name: 'SCSS',
        case_insensitive: true,
        illegal: '[=/|\']',
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          // to recognize keyframe 40% etc which are outside the scope of our
          // attribute value mode
          modes.CSS_NUMBER_MODE,
          {
            className: 'selector-id',
            begin: '#[A-Za-z0-9_-]+',
            relevance: 0
          },
          {
            className: 'selector-class',
            begin: '\\.[A-Za-z0-9_-]+',
            relevance: 0
          },
          modes.ATTRIBUTE_SELECTOR_MODE,
          {
            className: 'selector-tag',
            begin: '\\b(' + TAGS.join('|') + ')\\b',
            // was there, before, but why?
            relevance: 0
          },
          {
            className: 'selector-pseudo',
            begin: ':(' + PSEUDO_CLASSES$1.join('|') + ')'
          },
          {
            className: 'selector-pseudo',
            begin: ':(:)?(' + PSEUDO_ELEMENTS$1.join('|') + ')'
          },
          VARIABLE,
          { // pseudo-selector params
            begin: /\(/,
            end: /\)/,
            contains: [ modes.CSS_NUMBER_MODE ]
          },
          modes.CSS_VARIABLE,
          {
            className: 'attribute',
            begin: '\\b(' + ATTRIBUTES.join('|') + ')\\b'
          },
          { begin: '\\b(whitespace|wait|w-resize|visible|vertical-text|vertical-ideographic|uppercase|upper-roman|upper-alpha|underline|transparent|top|thin|thick|text|text-top|text-bottom|tb-rl|table-header-group|table-footer-group|sw-resize|super|strict|static|square|solid|small-caps|separate|se-resize|scroll|s-resize|rtl|row-resize|ridge|right|repeat|repeat-y|repeat-x|relative|progress|pointer|overline|outside|outset|oblique|nowrap|not-allowed|normal|none|nw-resize|no-repeat|no-drop|newspaper|ne-resize|n-resize|move|middle|medium|ltr|lr-tb|lowercase|lower-roman|lower-alpha|loose|list-item|line|line-through|line-edge|lighter|left|keep-all|justify|italic|inter-word|inter-ideograph|inside|inset|inline|inline-block|inherit|inactive|ideograph-space|ideograph-parenthesis|ideograph-numeric|ideograph-alpha|horizontal|hidden|help|hand|groove|fixed|ellipsis|e-resize|double|dotted|distribute|distribute-space|distribute-letter|distribute-all-lines|disc|disabled|default|decimal|dashed|crosshair|collapse|col-resize|circle|char|center|capitalize|break-word|break-all|bottom|both|bolder|bold|block|bidi-override|below|baseline|auto|always|all-scroll|absolute|table|table-cell)\\b' },
          {
            begin: /:/,
            end: /[;}{]/,
            relevance: 0,
            contains: [
              modes.BLOCK_COMMENT,
              VARIABLE,
              modes.HEXCOLOR,
              modes.CSS_NUMBER_MODE,
              hljs.QUOTE_STRING_MODE,
              hljs.APOS_STRING_MODE,
              modes.IMPORTANT,
              modes.FUNCTION_DISPATCH
            ]
          },
          // matching these here allows us to treat them more like regular CSS
          // rules so everything between the {} gets regular rule highlighting,
          // which is what we want for page and font-face
          {
            begin: '@(page|font-face)',
            keywords: {
              $pattern: AT_IDENTIFIER,
              keyword: '@page @font-face'
            }
          },
          {
            begin: '@',
            end: '[{;]',
            returnBegin: true,
            keywords: {
              $pattern: /[a-z-]+/,
              keyword: AT_MODIFIERS,
              attribute: MEDIA_FEATURES.join(" ")
            },
            contains: [
              {
                begin: AT_IDENTIFIER,
                className: "keyword"
              },
              {
                begin: /[a-z-]+(?=:)/,
                className: "attribute"
              },
              VARIABLE,
              hljs.QUOTE_STRING_MODE,
              hljs.APOS_STRING_MODE,
              modes.HEXCOLOR,
              modes.CSS_NUMBER_MODE
            ]
          },
          modes.FUNCTION_DISPATCH
        ]
      };
    }

    /*
    Language: Shell Session
    Requires: bash.js
    Author: TSUYUSATO Kitsune <make.just.on@gmail.com>
    Category: common
    Audit: 2020
    */

    /** @type LanguageFn */
    function shell(hljs) {
      return {
        name: 'Shell Session',
        aliases: [
          'console',
          'shellsession'
        ],
        contains: [
          {
            className: 'meta.prompt',
            // We cannot add \s (spaces) in the regular expression otherwise it will be too broad and produce unexpected result.
            // For instance, in the following example, it would match "echo /path/to/home >" as a prompt:
            // echo /path/to/home > t.exe
            begin: /^\s{0,3}[/~\w\d[\]()@-]*[>%$#][ ]?/,
            starts: {
              end: /[^\\](?=\s*$)/,
              subLanguage: 'bash'
            }
          }
        ]
      };
    }

    /*
    Language: Smalltalk
    Description: Smalltalk is an object-oriented, dynamically typed reflective programming language.
    Author: Vladimir Gubarkov <xonixx@gmail.com>
    Website: https://en.wikipedia.org/wiki/Smalltalk
    */

    function smalltalk(hljs) {
      const VAR_IDENT_RE = '[a-z][a-zA-Z0-9_]*';
      const CHAR = {
        className: 'string',
        begin: '\\$.{1}'
      };
      const SYMBOL = {
        className: 'symbol',
        begin: '#' + hljs.UNDERSCORE_IDENT_RE
      };
      return {
        name: 'Smalltalk',
        aliases: [ 'st' ],
        keywords: [
          "self",
          "super",
          "nil",
          "true",
          "false",
          "thisContext"
        ],
        contains: [
          hljs.COMMENT('"', '"'),
          hljs.APOS_STRING_MODE,
          {
            className: 'type',
            begin: '\\b[A-Z][A-Za-z0-9_]*',
            relevance: 0
          },
          {
            begin: VAR_IDENT_RE + ':',
            relevance: 0
          },
          hljs.C_NUMBER_MODE,
          SYMBOL,
          CHAR,
          {
            // This looks more complicated than needed to avoid combinatorial
            // explosion under V8. It effectively means `| var1 var2 ... |` with
            // whitespace adjacent to `|` being optional.
            begin: '\\|[ ]*' + VAR_IDENT_RE + '([ ]+' + VAR_IDENT_RE + ')*[ ]*\\|',
            returnBegin: true,
            end: /\|/,
            illegal: /\S/,
            contains: [ { begin: '(\\|[ ]*)?' + VAR_IDENT_RE } ]
          },
          {
            begin: '#\\(',
            end: '\\)',
            contains: [
              hljs.APOS_STRING_MODE,
              CHAR,
              hljs.C_NUMBER_MODE,
              SYMBOL
            ]
          }
        ]
      };
    }

    const keywordWrapper = keyword => concat(
      /\b/,
      keyword,
      /\w$/.test(keyword) ? /\b/ : /\B/
    );

    // Keywords that require a leading dot.
    const dotKeywords = [
      'Protocol', // contextual
      'Type' // contextual
    ].map(keywordWrapper);

    // Keywords that may have a leading dot.
    const optionalDotKeywords = [
      'init',
      'self'
    ].map(keywordWrapper);

    // should register as keyword, not type
    const keywordTypes = [
      'Any',
      'Self'
    ];

    // Regular keywords and literals.
    const keywords = [
      // strings below will be fed into the regular `keywords` engine while regex
      // will result in additional modes being created to scan for those keywords to
      // avoid conflicts with other rules
      'actor',
      'any', // contextual
      'associatedtype',
      'async',
      'await',
      /as\?/, // operator
      /as!/, // operator
      'as', // operator
      'break',
      'case',
      'catch',
      'class',
      'continue',
      'convenience', // contextual
      'default',
      'defer',
      'deinit',
      'didSet', // contextual
      'distributed',
      'do',
      'dynamic', // contextual
      'else',
      'enum',
      'extension',
      'fallthrough',
      /fileprivate\(set\)/,
      'fileprivate',
      'final', // contextual
      'for',
      'func',
      'get', // contextual
      'guard',
      'if',
      'import',
      'indirect', // contextual
      'infix', // contextual
      /init\?/,
      /init!/,
      'inout',
      /internal\(set\)/,
      'internal',
      'in',
      'is', // operator
      'isolated', // contextual
      'nonisolated', // contextual
      'lazy', // contextual
      'let',
      'mutating', // contextual
      'nonmutating', // contextual
      /open\(set\)/, // contextual
      'open', // contextual
      'operator',
      'optional', // contextual
      'override', // contextual
      'postfix', // contextual
      'precedencegroup',
      'prefix', // contextual
      /private\(set\)/,
      'private',
      'protocol',
      /public\(set\)/,
      'public',
      'repeat',
      'required', // contextual
      'rethrows',
      'return',
      'set', // contextual
      'some', // contextual
      'static',
      'struct',
      'subscript',
      'super',
      'switch',
      'throws',
      'throw',
      /try\?/, // operator
      /try!/, // operator
      'try', // operator
      'typealias',
      /unowned\(safe\)/, // contextual
      /unowned\(unsafe\)/, // contextual
      'unowned', // contextual
      'var',
      'weak', // contextual
      'where',
      'while',
      'willSet' // contextual
    ];

    // NOTE: Contextual keywords are reserved only in specific contexts.
    // Ideally, these should be matched using modes to avoid false positives.

    // Literals.
    const literals = [
      'false',
      'nil',
      'true'
    ];

    // Keywords used in precedence groups.
    const precedencegroupKeywords = [
      'assignment',
      'associativity',
      'higherThan',
      'left',
      'lowerThan',
      'none',
      'right'
    ];

    // Keywords that start with a number sign (#).
    // #(un)available is handled separately.
    const numberSignKeywords = [
      '#colorLiteral',
      '#column',
      '#dsohandle',
      '#else',
      '#elseif',
      '#endif',
      '#error',
      '#file',
      '#fileID',
      '#fileLiteral',
      '#filePath',
      '#function',
      '#if',
      '#imageLiteral',
      '#keyPath',
      '#line',
      '#selector',
      '#sourceLocation',
      '#warn_unqualified_access',
      '#warning'
    ];

    // Global functions in the Standard Library.
    const builtIns$1 = [
      'abs',
      'all',
      'any',
      'assert',
      'assertionFailure',
      'debugPrint',
      'dump',
      'fatalError',
      'getVaList',
      'isKnownUniquelyReferenced',
      'max',
      'min',
      'numericCast',
      'pointwiseMax',
      'pointwiseMin',
      'precondition',
      'preconditionFailure',
      'print',
      'readLine',
      'repeatElement',
      'sequence',
      'stride',
      'swap',
      'swift_unboxFromSwiftValueWithType',
      'transcode',
      'type',
      'unsafeBitCast',
      'unsafeDowncast',
      'withExtendedLifetime',
      'withUnsafeMutablePointer',
      'withUnsafePointer',
      'withVaList',
      'withoutActuallyEscaping',
      'zip'
    ];

    // Valid first characters for operators.
    const operatorHead = either(
      /[/=\-+!*%<>&|^~?]/,
      /[\u00A1-\u00A7]/,
      /[\u00A9\u00AB]/,
      /[\u00AC\u00AE]/,
      /[\u00B0\u00B1]/,
      /[\u00B6\u00BB\u00BF\u00D7\u00F7]/,
      /[\u2016-\u2017]/,
      /[\u2020-\u2027]/,
      /[\u2030-\u203E]/,
      /[\u2041-\u2053]/,
      /[\u2055-\u205E]/,
      /[\u2190-\u23FF]/,
      /[\u2500-\u2775]/,
      /[\u2794-\u2BFF]/,
      /[\u2E00-\u2E7F]/,
      /[\u3001-\u3003]/,
      /[\u3008-\u3020]/,
      /[\u3030]/
    );

    // Valid characters for operators.
    const operatorCharacter = either(
      operatorHead,
      /[\u0300-\u036F]/,
      /[\u1DC0-\u1DFF]/,
      /[\u20D0-\u20FF]/,
      /[\uFE00-\uFE0F]/,
      /[\uFE20-\uFE2F]/
      // TODO: The following characters are also allowed, but the regex isn't supported yet.
      // /[\u{E0100}-\u{E01EF}]/u
    );

    // Valid operator.
    const operator = concat(operatorHead, operatorCharacter, '*');

    // Valid first characters for identifiers.
    const identifierHead = either(
      /[a-zA-Z_]/,
      /[\u00A8\u00AA\u00AD\u00AF\u00B2-\u00B5\u00B7-\u00BA]/,
      /[\u00BC-\u00BE\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]/,
      /[\u0100-\u02FF\u0370-\u167F\u1681-\u180D\u180F-\u1DBF]/,
      /[\u1E00-\u1FFF]/,
      /[\u200B-\u200D\u202A-\u202E\u203F-\u2040\u2054\u2060-\u206F]/,
      /[\u2070-\u20CF\u2100-\u218F\u2460-\u24FF\u2776-\u2793]/,
      /[\u2C00-\u2DFF\u2E80-\u2FFF]/,
      /[\u3004-\u3007\u3021-\u302F\u3031-\u303F\u3040-\uD7FF]/,
      /[\uF900-\uFD3D\uFD40-\uFDCF\uFDF0-\uFE1F\uFE30-\uFE44]/,
      /[\uFE47-\uFEFE\uFF00-\uFFFD]/ // Should be /[\uFE47-\uFFFD]/, but we have to exclude FEFF.
      // The following characters are also allowed, but the regexes aren't supported yet.
      // /[\u{10000}-\u{1FFFD}\u{20000-\u{2FFFD}\u{30000}-\u{3FFFD}\u{40000}-\u{4FFFD}]/u,
      // /[\u{50000}-\u{5FFFD}\u{60000-\u{6FFFD}\u{70000}-\u{7FFFD}\u{80000}-\u{8FFFD}]/u,
      // /[\u{90000}-\u{9FFFD}\u{A0000-\u{AFFFD}\u{B0000}-\u{BFFFD}\u{C0000}-\u{CFFFD}]/u,
      // /[\u{D0000}-\u{DFFFD}\u{E0000-\u{EFFFD}]/u
    );

    // Valid characters for identifiers.
    const identifierCharacter = either(
      identifierHead,
      /\d/,
      /[\u0300-\u036F\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/
    );

    // Valid identifier.
    const identifier = concat(identifierHead, identifierCharacter, '*');

    // Valid type identifier.
    const typeIdentifier = concat(/[A-Z]/, identifierCharacter, '*');

    // Built-in attributes, which are highlighted as keywords.
    // @available is handled separately.
    const keywordAttributes = [
      'autoclosure',
      concat(/convention\(/, either('swift', 'block', 'c'), /\)/),
      'discardableResult',
      'dynamicCallable',
      'dynamicMemberLookup',
      'escaping',
      'frozen',
      'GKInspectable',
      'IBAction',
      'IBDesignable',
      'IBInspectable',
      'IBOutlet',
      'IBSegueAction',
      'inlinable',
      'main',
      'nonobjc',
      'NSApplicationMain',
      'NSCopying',
      'NSManaged',
      concat(/objc\(/, identifier, /\)/),
      'objc',
      'objcMembers',
      'propertyWrapper',
      'requires_stored_property_inits',
      'resultBuilder',
      'testable',
      'UIApplicationMain',
      'unknown',
      'usableFromInline'
    ];

    // Contextual keywords used in @available and #(un)available.
    const availabilityKeywords = [
      'iOS',
      'iOSApplicationExtension',
      'macOS',
      'macOSApplicationExtension',
      'macCatalyst',
      'macCatalystApplicationExtension',
      'watchOS',
      'watchOSApplicationExtension',
      'tvOS',
      'tvOSApplicationExtension',
      'swift'
    ];

    /*
    Language: Swift
    Description: Swift is a general-purpose programming language built using a modern approach to safety, performance, and software design patterns.
    Author: Steven Van Impe <steven.vanimpe@icloud.com>
    Contributors: Chris Eidhof <chris@eidhof.nl>, Nate Cook <natecook@gmail.com>, Alexander Lichter <manniL@gmx.net>, Richard Gibson <gibson042@github>
    Website: https://swift.org
    Category: common, system
    */

    /** @type LanguageFn */
    function swift(hljs) {
      const WHITESPACE = {
        match: /\s+/,
        relevance: 0
      };
      // https://docs.swift.org/swift-book/ReferenceManual/LexicalStructure.html#ID411
      const BLOCK_COMMENT = hljs.COMMENT(
        '/\\*',
        '\\*/',
        { contains: [ 'self' ] }
      );
      const COMMENTS = [
        hljs.C_LINE_COMMENT_MODE,
        BLOCK_COMMENT
      ];

      // https://docs.swift.org/swift-book/ReferenceManual/LexicalStructure.html#ID413
      // https://docs.swift.org/swift-book/ReferenceManual/zzSummaryOfTheGrammar.html
      const DOT_KEYWORD = {
        match: [
          /\./,
          either(...dotKeywords, ...optionalDotKeywords)
        ],
        className: { 2: "keyword" }
      };
      const KEYWORD_GUARD = {
        // Consume .keyword to prevent highlighting properties and methods as keywords.
        match: concat(/\./, either(...keywords)),
        relevance: 0
      };
      const PLAIN_KEYWORDS = keywords
        .filter(kw => typeof kw === 'string')
        .concat([ "_|0" ]); // seems common, so 0 relevance
      const REGEX_KEYWORDS = keywords
        .filter(kw => typeof kw !== 'string') // find regex
        .concat(keywordTypes)
        .map(keywordWrapper);
      const KEYWORD = { variants: [
        {
          className: 'keyword',
          match: either(...REGEX_KEYWORDS, ...optionalDotKeywords)
        }
      ] };
      // find all the regular keywords
      const KEYWORDS = {
        $pattern: either(
          /\b\w+/, // regular keywords
          /#\w+/ // number keywords
        ),
        keyword: PLAIN_KEYWORDS
          .concat(numberSignKeywords),
        literal: literals
      };
      const KEYWORD_MODES = [
        DOT_KEYWORD,
        KEYWORD_GUARD,
        KEYWORD
      ];

      // https://github.com/apple/swift/tree/main/stdlib/public/core
      const BUILT_IN_GUARD = {
        // Consume .built_in to prevent highlighting properties and methods.
        match: concat(/\./, either(...builtIns$1)),
        relevance: 0
      };
      const BUILT_IN = {
        className: 'built_in',
        match: concat(/\b/, either(...builtIns$1), /(?=\()/)
      };
      const BUILT_INS = [
        BUILT_IN_GUARD,
        BUILT_IN
      ];

      // https://docs.swift.org/swift-book/ReferenceManual/LexicalStructure.html#ID418
      const OPERATOR_GUARD = {
        // Prevent -> from being highlighting as an operator.
        match: /->/,
        relevance: 0
      };
      const OPERATOR = {
        className: 'operator',
        relevance: 0,
        variants: [
          { match: operator },
          {
            // dot-operator: only operators that start with a dot are allowed to use dots as
            // characters (..., ...<, .*, etc). So there rule here is: a dot followed by one or more
            // characters that may also include dots.
            match: `\\.(\\.|${operatorCharacter})+` }
        ]
      };
      const OPERATORS = [
        OPERATOR_GUARD,
        OPERATOR
      ];

      // https://docs.swift.org/swift-book/ReferenceManual/LexicalStructure.html#grammar_numeric-literal
      // TODO: Update for leading `-` after lookbehind is supported everywhere
      const decimalDigits = '([0-9]_*)+';
      const hexDigits = '([0-9a-fA-F]_*)+';
      const NUMBER = {
        className: 'number',
        relevance: 0,
        variants: [
          // decimal floating-point-literal (subsumes decimal-literal)
          { match: `\\b(${decimalDigits})(\\.(${decimalDigits}))?` + `([eE][+-]?(${decimalDigits}))?\\b` },
          // hexadecimal floating-point-literal (subsumes hexadecimal-literal)
          { match: `\\b0x(${hexDigits})(\\.(${hexDigits}))?` + `([pP][+-]?(${decimalDigits}))?\\b` },
          // octal-literal
          { match: /\b0o([0-7]_*)+\b/ },
          // binary-literal
          { match: /\b0b([01]_*)+\b/ }
        ]
      };

      // https://docs.swift.org/swift-book/ReferenceManual/LexicalStructure.html#grammar_string-literal
      const ESCAPED_CHARACTER = (rawDelimiter = "") => ({
        className: 'subst',
        variants: [
          { match: concat(/\\/, rawDelimiter, /[0\\tnr"']/) },
          { match: concat(/\\/, rawDelimiter, /u\{[0-9a-fA-F]{1,8}\}/) }
        ]
      });
      const ESCAPED_NEWLINE = (rawDelimiter = "") => ({
        className: 'subst',
        match: concat(/\\/, rawDelimiter, /[\t ]*(?:[\r\n]|\r\n)/)
      });
      const INTERPOLATION = (rawDelimiter = "") => ({
        className: 'subst',
        label: "interpol",
        begin: concat(/\\/, rawDelimiter, /\(/),
        end: /\)/
      });
      const MULTILINE_STRING = (rawDelimiter = "") => ({
        begin: concat(rawDelimiter, /"""/),
        end: concat(/"""/, rawDelimiter),
        contains: [
          ESCAPED_CHARACTER(rawDelimiter),
          ESCAPED_NEWLINE(rawDelimiter),
          INTERPOLATION(rawDelimiter)
        ]
      });
      const SINGLE_LINE_STRING = (rawDelimiter = "") => ({
        begin: concat(rawDelimiter, /"/),
        end: concat(/"/, rawDelimiter),
        contains: [
          ESCAPED_CHARACTER(rawDelimiter),
          INTERPOLATION(rawDelimiter)
        ]
      });
      const STRING = {
        className: 'string',
        variants: [
          MULTILINE_STRING(),
          MULTILINE_STRING("#"),
          MULTILINE_STRING("##"),
          MULTILINE_STRING("###"),
          SINGLE_LINE_STRING(),
          SINGLE_LINE_STRING("#"),
          SINGLE_LINE_STRING("##"),
          SINGLE_LINE_STRING("###")
        ]
      };

      // https://docs.swift.org/swift-book/ReferenceManual/LexicalStructure.html#ID412
      const QUOTED_IDENTIFIER = { match: concat(/`/, identifier, /`/) };
      const IMPLICIT_PARAMETER = {
        className: 'variable',
        match: /\$\d+/
      };
      const PROPERTY_WRAPPER_PROJECTION = {
        className: 'variable',
        match: `\\$${identifierCharacter}+`
      };
      const IDENTIFIERS = [
        QUOTED_IDENTIFIER,
        IMPLICIT_PARAMETER,
        PROPERTY_WRAPPER_PROJECTION
      ];

      // https://docs.swift.org/swift-book/ReferenceManual/Attributes.html
      const AVAILABLE_ATTRIBUTE = {
        match: /(@|#(un)?)available/,
        className: "keyword",
        starts: { contains: [
          {
            begin: /\(/,
            end: /\)/,
            keywords: availabilityKeywords,
            contains: [
              ...OPERATORS,
              NUMBER,
              STRING
            ]
          }
        ] }
      };
      const KEYWORD_ATTRIBUTE = {
        className: 'keyword',
        match: concat(/@/, either(...keywordAttributes))
      };
      const USER_DEFINED_ATTRIBUTE = {
        className: 'meta',
        match: concat(/@/, identifier)
      };
      const ATTRIBUTES = [
        AVAILABLE_ATTRIBUTE,
        KEYWORD_ATTRIBUTE,
        USER_DEFINED_ATTRIBUTE
      ];

      // https://docs.swift.org/swift-book/ReferenceManual/Types.html
      const TYPE = {
        match: lookahead(/\b[A-Z]/),
        relevance: 0,
        contains: [
          { // Common Apple frameworks, for relevance boost
            className: 'type',
            match: concat(/(AV|CA|CF|CG|CI|CL|CM|CN|CT|MK|MP|MTK|MTL|NS|SCN|SK|UI|WK|XC)/, identifierCharacter, '+')
          },
          { // Type identifier
            className: 'type',
            match: typeIdentifier,
            relevance: 0
          },
          { // Optional type
            match: /[?!]+/,
            relevance: 0
          },
          { // Variadic parameter
            match: /\.\.\./,
            relevance: 0
          },
          { // Protocol composition
            match: concat(/\s+&\s+/, lookahead(typeIdentifier)),
            relevance: 0
          }
        ]
      };
      const GENERIC_ARGUMENTS = {
        begin: /</,
        end: />/,
        keywords: KEYWORDS,
        contains: [
          ...COMMENTS,
          ...KEYWORD_MODES,
          ...ATTRIBUTES,
          OPERATOR_GUARD,
          TYPE
        ]
      };
      TYPE.contains.push(GENERIC_ARGUMENTS);

      // https://docs.swift.org/swift-book/ReferenceManual/Expressions.html#ID552
      // Prevents element names from being highlighted as keywords.
      const TUPLE_ELEMENT_NAME = {
        match: concat(identifier, /\s*:/),
        keywords: "_|0",
        relevance: 0
      };
      // Matches tuples as well as the parameter list of a function type.
      const TUPLE = {
        begin: /\(/,
        end: /\)/,
        relevance: 0,
        keywords: KEYWORDS,
        contains: [
          'self',
          TUPLE_ELEMENT_NAME,
          ...COMMENTS,
          ...KEYWORD_MODES,
          ...BUILT_INS,
          ...OPERATORS,
          NUMBER,
          STRING,
          ...IDENTIFIERS,
          ...ATTRIBUTES,
          TYPE
        ]
      };

      const GENERIC_PARAMETERS = {
        begin: /</,
        end: />/,
        contains: [
          ...COMMENTS,
          TYPE
        ]
      };
      const FUNCTION_PARAMETER_NAME = {
        begin: either(
          lookahead(concat(identifier, /\s*:/)),
          lookahead(concat(identifier, /\s+/, identifier, /\s*:/))
        ),
        end: /:/,
        relevance: 0,
        contains: [
          {
            className: 'keyword',
            match: /\b_\b/
          },
          {
            className: 'params',
            match: identifier
          }
        ]
      };
      const FUNCTION_PARAMETERS = {
        begin: /\(/,
        end: /\)/,
        keywords: KEYWORDS,
        contains: [
          FUNCTION_PARAMETER_NAME,
          ...COMMENTS,
          ...KEYWORD_MODES,
          ...OPERATORS,
          NUMBER,
          STRING,
          ...ATTRIBUTES,
          TYPE,
          TUPLE
        ],
        endsParent: true,
        illegal: /["']/
      };
      // https://docs.swift.org/swift-book/ReferenceManual/Declarations.html#ID362
      const FUNCTION = {
        match: [
          /func/,
          /\s+/,
          either(QUOTED_IDENTIFIER.match, identifier, operator)
        ],
        className: {
          1: "keyword",
          3: "title.function"
        },
        contains: [
          GENERIC_PARAMETERS,
          FUNCTION_PARAMETERS,
          WHITESPACE
        ],
        illegal: [
          /\[/,
          /%/
        ]
      };

      // https://docs.swift.org/swift-book/ReferenceManual/Declarations.html#ID375
      // https://docs.swift.org/swift-book/ReferenceManual/Declarations.html#ID379
      const INIT_SUBSCRIPT = {
        match: [
          /\b(?:subscript|init[?!]?)/,
          /\s*(?=[<(])/,
        ],
        className: { 1: "keyword" },
        contains: [
          GENERIC_PARAMETERS,
          FUNCTION_PARAMETERS,
          WHITESPACE
        ],
        illegal: /\[|%/
      };
      // https://docs.swift.org/swift-book/ReferenceManual/Declarations.html#ID380
      const OPERATOR_DECLARATION = {
        match: [
          /operator/,
          /\s+/,
          operator
        ],
        className: {
          1: "keyword",
          3: "title"
        }
      };

      // https://docs.swift.org/swift-book/ReferenceManual/Declarations.html#ID550
      const PRECEDENCEGROUP = {
        begin: [
          /precedencegroup/,
          /\s+/,
          typeIdentifier
        ],
        className: {
          1: "keyword",
          3: "title"
        },
        contains: [ TYPE ],
        keywords: [
          ...precedencegroupKeywords,
          ...literals
        ],
        end: /}/
      };

      // Add supported submodes to string interpolation.
      for (const variant of STRING.variants) {
        const interpolation = variant.contains.find(mode => mode.label === "interpol");
        // TODO: Interpolation can contain any expression, so there's room for improvement here.
        interpolation.keywords = KEYWORDS;
        const submodes = [
          ...KEYWORD_MODES,
          ...BUILT_INS,
          ...OPERATORS,
          NUMBER,
          STRING,
          ...IDENTIFIERS
        ];
        interpolation.contains = [
          ...submodes,
          {
            begin: /\(/,
            end: /\)/,
            contains: [
              'self',
              ...submodes
            ]
          }
        ];
      }

      return {
        name: 'Swift',
        keywords: KEYWORDS,
        contains: [
          ...COMMENTS,
          FUNCTION,
          INIT_SUBSCRIPT,
          {
            beginKeywords: 'struct protocol class extension enum actor',
            end: '\\{',
            excludeEnd: true,
            keywords: KEYWORDS,
            contains: [
              hljs.inherit(hljs.TITLE_MODE, {
                className: "title.class",
                begin: /[A-Za-z$_][\u00C0-\u02B80-9A-Za-z$_]*/
              }),
              ...KEYWORD_MODES
            ]
          },
          OPERATOR_DECLARATION,
          PRECEDENCEGROUP,
          {
            beginKeywords: 'import',
            end: /$/,
            contains: [ ...COMMENTS ],
            relevance: 0
          },
          ...KEYWORD_MODES,
          ...BUILT_INS,
          ...OPERATORS,
          NUMBER,
          STRING,
          ...IDENTIFIERS,
          ...ATTRIBUTES,
          TYPE,
          TUPLE
        ]
      };
    }

    /*
    Language: Tcl
    Description: Tcl is a very simple programming language.
    Author: Radek Liska <radekliska@gmail.com>
    Website: https://www.tcl.tk/about/language.html
    */

    function tcl(hljs) {
      const regex = hljs.regex;
      const TCL_IDENT = /[a-zA-Z_][a-zA-Z0-9_]*/;

      const NUMBER = {
        className: 'number',
        variants: [
          hljs.BINARY_NUMBER_MODE,
          hljs.C_NUMBER_MODE
        ]
      };

      const KEYWORDS = [
        "after",
        "append",
        "apply",
        "array",
        "auto_execok",
        "auto_import",
        "auto_load",
        "auto_mkindex",
        "auto_mkindex_old",
        "auto_qualify",
        "auto_reset",
        "bgerror",
        "binary",
        "break",
        "catch",
        "cd",
        "chan",
        "clock",
        "close",
        "concat",
        "continue",
        "dde",
        "dict",
        "encoding",
        "eof",
        "error",
        "eval",
        "exec",
        "exit",
        "expr",
        "fblocked",
        "fconfigure",
        "fcopy",
        "file",
        "fileevent",
        "filename",
        "flush",
        "for",
        "foreach",
        "format",
        "gets",
        "glob",
        "global",
        "history",
        "http",
        "if",
        "incr",
        "info",
        "interp",
        "join",
        "lappend|10",
        "lassign|10",
        "lindex|10",
        "linsert|10",
        "list",
        "llength|10",
        "load",
        "lrange|10",
        "lrepeat|10",
        "lreplace|10",
        "lreverse|10",
        "lsearch|10",
        "lset|10",
        "lsort|10",
        "mathfunc",
        "mathop",
        "memory",
        "msgcat",
        "namespace",
        "open",
        "package",
        "parray",
        "pid",
        "pkg::create",
        "pkg_mkIndex",
        "platform",
        "platform::shell",
        "proc",
        "puts",
        "pwd",
        "read",
        "refchan",
        "regexp",
        "registry",
        "regsub|10",
        "rename",
        "return",
        "safe",
        "scan",
        "seek",
        "set",
        "socket",
        "source",
        "split",
        "string",
        "subst",
        "switch",
        "tcl_endOfWord",
        "tcl_findLibrary",
        "tcl_startOfNextWord",
        "tcl_startOfPreviousWord",
        "tcl_wordBreakAfter",
        "tcl_wordBreakBefore",
        "tcltest",
        "tclvars",
        "tell",
        "time",
        "tm",
        "trace",
        "unknown",
        "unload",
        "unset",
        "update",
        "uplevel",
        "upvar",
        "variable",
        "vwait",
        "while"
      ];

      return {
        name: 'Tcl',
        aliases: [ 'tk' ],
        keywords: KEYWORDS,
        contains: [
          hljs.COMMENT(';[ \\t]*#', '$'),
          hljs.COMMENT('^[ \\t]*#', '$'),
          {
            beginKeywords: 'proc',
            end: '[\\{]',
            excludeEnd: true,
            contains: [
              {
                className: 'title',
                begin: '[ \\t\\n\\r]+(::)?[a-zA-Z_]((::)?[a-zA-Z0-9_])*',
                end: '[ \\t\\n\\r]',
                endsWithParent: true,
                excludeEnd: true
              }
            ]
          },
          {
            className: "variable",
            variants: [
              { begin: regex.concat(
                /\$/,
                regex.optional(/::/),
                TCL_IDENT,
                '(::',
                TCL_IDENT,
                ')*'
              ) },
              {
                begin: '\\$\\{(::)?[a-zA-Z_]((::)?[a-zA-Z0-9_])*',
                end: '\\}',
                contains: [ NUMBER ]
              }
            ]
          },
          {
            className: 'string',
            contains: [ hljs.BACKSLASH_ESCAPE ],
            variants: [ hljs.inherit(hljs.QUOTE_STRING_MODE, { illegal: null }) ]
          },
          NUMBER
        ]
      };
    }

    /*
    Language: Thrift
    Author: Oleg Efimov <efimovov@gmail.com>
    Description: Thrift message definition format
    Website: https://thrift.apache.org
    Category: protocols
    */

    function thrift(hljs) {
      const TYPES = [
        "bool",
        "byte",
        "i16",
        "i32",
        "i64",
        "double",
        "string",
        "binary"
      ];
      const KEYWORDS = [
        "namespace",
        "const",
        "typedef",
        "struct",
        "enum",
        "service",
        "exception",
        "void",
        "oneway",
        "set",
        "list",
        "map",
        "required",
        "optional"
      ];
      return {
        name: 'Thrift',
        keywords: {
          keyword: KEYWORDS,
          type: TYPES,
          literal: 'true false'
        },
        contains: [
          hljs.QUOTE_STRING_MODE,
          hljs.NUMBER_MODE,
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          {
            className: 'class',
            beginKeywords: 'struct enum service exception',
            end: /\{/,
            illegal: /\n/,
            contains: [
              hljs.inherit(hljs.TITLE_MODE, {
                // hack: eating everything after the first title
                starts: {
                  endsWithParent: true,
                  excludeEnd: true
                } })
            ]
          },
          {
            begin: '\\b(set|list|map)\\s*<',
            keywords: { type: [
              ...TYPES,
              "set",
              "list",
              "map"
            ] },
            end: '>',
            contains: [ 'self' ]
          }
        ]
      };
    }

    /*
    Language: TypeScript
    Author: Panu Horsmalahti <panu.horsmalahti@iki.fi>
    Contributors: Ike Ku <dempfi@yahoo.com>
    Description: TypeScript is a strict superset of JavaScript
    Website: https://www.typescriptlang.org
    Category: common, scripting
    */

    /** @type LanguageFn */
    function typescript(hljs) {
      const tsLanguage = javascript(hljs);

      const IDENT_RE$1 = IDENT_RE;
      const TYPES = [
        "any",
        "void",
        "number",
        "boolean",
        "string",
        "object",
        "never",
        "symbol",
        "bigint",
        "unknown"
      ];
      const NAMESPACE = {
        beginKeywords: 'namespace',
        end: /\{/,
        excludeEnd: true,
        contains: [ tsLanguage.exports.CLASS_REFERENCE ]
      };
      const INTERFACE = {
        beginKeywords: 'interface',
        end: /\{/,
        excludeEnd: true,
        keywords: {
          keyword: 'interface extends',
          built_in: TYPES
        },
        contains: [ tsLanguage.exports.CLASS_REFERENCE ]
      };
      const USE_STRICT = {
        className: 'meta',
        relevance: 10,
        begin: /^\s*['"]use strict['"]/
      };
      const TS_SPECIFIC_KEYWORDS = [
        "type",
        "namespace",
        "interface",
        "public",
        "private",
        "protected",
        "implements",
        "declare",
        "abstract",
        "readonly",
        "enum",
        "override"
      ];
      const KEYWORDS$1 = {
        $pattern: IDENT_RE,
        keyword: KEYWORDS.concat(TS_SPECIFIC_KEYWORDS),
        literal: LITERALS,
        built_in: BUILT_INS.concat(TYPES),
        "variable.language": BUILT_IN_VARIABLES
      };
      const DECORATOR = {
        className: 'meta',
        begin: '@' + IDENT_RE$1,
      };

      const swapMode = (mode, label, replacement) => {
        const indx = mode.contains.findIndex(m => m.label === label);
        if (indx === -1) { throw new Error("can not find mode to replace"); }

        mode.contains.splice(indx, 1, replacement);
      };


      // this should update anywhere keywords is used since
      // it will be the same actual JS object
      Object.assign(tsLanguage.keywords, KEYWORDS$1);

      tsLanguage.exports.PARAMS_CONTAINS.push(DECORATOR);
      tsLanguage.contains = tsLanguage.contains.concat([
        DECORATOR,
        NAMESPACE,
        INTERFACE,
      ]);

      // TS gets a simpler shebang rule than JS
      swapMode(tsLanguage, "shebang", hljs.SHEBANG());
      // JS use strict rule purposely excludes `asm` which makes no sense
      swapMode(tsLanguage, "use_strict", USE_STRICT);

      const functionDeclaration = tsLanguage.contains.find(m => m.label === "func.def");
      functionDeclaration.relevance = 0; // () => {} is more typical in TypeScript

      Object.assign(tsLanguage, {
        name: 'TypeScript',
        aliases: [
          'ts',
          'tsx',
          'mts',
          'cts'
        ]
      });

      return tsLanguage;
    }

    /*
    Language: Vala
    Author: Antono Vasiljev <antono.vasiljev@gmail.com>
    Description: Vala is a new programming language that aims to bring modern programming language features to GNOME developers without imposing any additional runtime requirements and without using a different ABI compared to applications and libraries written in C.
    Website: https://wiki.gnome.org/Projects/Vala
    */

    function vala(hljs) {
      return {
        name: 'Vala',
        keywords: {
          keyword:
            // Value types
            'char uchar unichar int uint long ulong short ushort int8 int16 int32 int64 uint8 '
            + 'uint16 uint32 uint64 float double bool struct enum string void '
            // Reference types
            + 'weak unowned owned '
            // Modifiers
            + 'async signal static abstract interface override virtual delegate '
            // Control Structures
            + 'if while do for foreach else switch case break default return try catch '
            // Visibility
            + 'public private protected internal '
            // Other
            + 'using new this get set const stdout stdin stderr var',
          built_in:
            'DBus GLib CCode Gee Object Gtk Posix',
          literal:
            'false true null'
        },
        contains: [
          {
            className: 'class',
            beginKeywords: 'class interface namespace',
            end: /\{/,
            excludeEnd: true,
            illegal: '[^,:\\n\\s\\.]',
            contains: [ hljs.UNDERSCORE_TITLE_MODE ]
          },
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          {
            className: 'string',
            begin: '"""',
            end: '"""',
            relevance: 5
          },
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE,
          hljs.C_NUMBER_MODE,
          {
            className: 'meta',
            begin: '^#',
            end: '$',
          }
        ]
      };
    }

    /*
    Language: Vim Script
    Author: Jun Yang <yangjvn@126.com>
    Description: full keyword and built-in from http://vimdoc.sourceforge.net/htmldoc/
    Website: https://www.vim.org
    Category: scripting
    */

    function vim(hljs) {
      return {
        name: 'Vim Script',
        keywords: {
          $pattern: /[!#@\w]+/,
          keyword:
            // express version except: ! & * < = > !! # @ @@
            'N|0 P|0 X|0 a|0 ab abc abo al am an|0 ar arga argd arge argdo argg argl argu as au aug aun b|0 bN ba bad bd be bel bf bl bm bn bo bp br brea breaka breakd breakl bro bufdo buffers bun bw c|0 cN cNf ca cabc caddb cad caddf cal cat cb cc ccl cd ce cex cf cfir cgetb cgete cg changes chd che checkt cl cla clo cm cmapc cme cn cnew cnf cno cnorea cnoreme co col colo com comc comp con conf cope '
            + 'cp cpf cq cr cs cst cu cuna cunme cw delm deb debugg delc delf dif diffg diffo diffp diffpu diffs diffthis dig di dl dell dj dli do doautoa dp dr ds dsp e|0 ea ec echoe echoh echom echon el elsei em en endfo endf endt endw ene ex exe exi exu f|0 files filet fin fina fini fir fix fo foldc foldd folddoc foldo for fu go gr grepa gu gv ha helpf helpg helpt hi hid his ia iabc if ij il im imapc '
            + 'ime ino inorea inoreme int is isp iu iuna iunme j|0 ju k|0 keepa kee keepj lN lNf l|0 lad laddb laddf la lan lat lb lc lch lcl lcs le lefta let lex lf lfir lgetb lgete lg lgr lgrepa lh ll lla lli lmak lm lmapc lne lnew lnf ln loadk lo loc lockv lol lope lp lpf lr ls lt lu lua luad luaf lv lvimgrepa lw m|0 ma mak map mapc marks mat me menut mes mk mks mksp mkv mkvie mod mz mzf nbc nb nbs new nm nmapc nme nn nnoreme noa no noh norea noreme norm nu nun nunme ol o|0 om omapc ome on ono onoreme opt ou ounme ow p|0 '
            + 'profd prof pro promptr pc ped pe perld po popu pp pre prev ps pt ptN ptf ptj ptl ptn ptp ptr pts pu pw py3 python3 py3d py3f py pyd pyf quita qa rec red redi redr redraws reg res ret retu rew ri rightb rub rubyd rubyf rund ru rv sN san sa sal sav sb sbN sba sbf sbl sbm sbn sbp sbr scrip scripte scs se setf setg setl sf sfir sh sim sig sil sl sla sm smap smapc sme sn sni sno snor snoreme sor '
            + 'so spelld spe spelli spellr spellu spellw sp spr sre st sta startg startr star stopi stj sts sun sunm sunme sus sv sw sy synti sync tN tabN tabc tabdo tabe tabf tabfir tabl tabm tabnew '
            + 'tabn tabo tabp tabr tabs tab ta tags tc tcld tclf te tf th tj tl tm tn to tp tr try ts tu u|0 undoj undol una unh unl unlo unm unme uns up ve verb vert vim vimgrepa vi viu vie vm vmapc vme vne vn vnoreme vs vu vunme windo w|0 wN wa wh wi winc winp wn wp wq wqa ws wu wv x|0 xa xmapc xm xme xn xnoreme xu xunme y|0 z|0 ~ '
            // full version
            + 'Next Print append abbreviate abclear aboveleft all amenu anoremenu args argadd argdelete argedit argglobal arglocal argument ascii autocmd augroup aunmenu buffer bNext ball badd bdelete behave belowright bfirst blast bmodified bnext botright bprevious brewind break breakadd breakdel breaklist browse bunload '
            + 'bwipeout change cNext cNfile cabbrev cabclear caddbuffer caddexpr caddfile call catch cbuffer cclose center cexpr cfile cfirst cgetbuffer cgetexpr cgetfile chdir checkpath checktime clist clast close cmap cmapclear cmenu cnext cnewer cnfile cnoremap cnoreabbrev cnoremenu copy colder colorscheme command comclear compiler continue confirm copen cprevious cpfile cquit crewind cscope cstag cunmap '
            + 'cunabbrev cunmenu cwindow delete delmarks debug debuggreedy delcommand delfunction diffupdate diffget diffoff diffpatch diffput diffsplit digraphs display deletel djump dlist doautocmd doautoall deletep drop dsearch dsplit edit earlier echo echoerr echohl echomsg else elseif emenu endif endfor '
            + 'endfunction endtry endwhile enew execute exit exusage file filetype find finally finish first fixdel fold foldclose folddoopen folddoclosed foldopen function global goto grep grepadd gui gvim hardcopy help helpfind helpgrep helptags highlight hide history insert iabbrev iabclear ijump ilist imap '
            + 'imapclear imenu inoremap inoreabbrev inoremenu intro isearch isplit iunmap iunabbrev iunmenu join jumps keepalt keepmarks keepjumps lNext lNfile list laddexpr laddbuffer laddfile last language later lbuffer lcd lchdir lclose lcscope left leftabove lexpr lfile lfirst lgetbuffer lgetexpr lgetfile lgrep lgrepadd lhelpgrep llast llist lmake lmap lmapclear lnext lnewer lnfile lnoremap loadkeymap loadview '
            + 'lockmarks lockvar lolder lopen lprevious lpfile lrewind ltag lunmap luado luafile lvimgrep lvimgrepadd lwindow move mark make mapclear match menu menutranslate messages mkexrc mksession mkspell mkvimrc mkview mode mzscheme mzfile nbclose nbkey nbsart next nmap nmapclear nmenu nnoremap '
            + 'nnoremenu noautocmd noremap nohlsearch noreabbrev noremenu normal number nunmap nunmenu oldfiles open omap omapclear omenu only onoremap onoremenu options ounmap ounmenu ownsyntax print profdel profile promptfind promptrepl pclose pedit perl perldo pop popup ppop preserve previous psearch ptag ptNext '
            + 'ptfirst ptjump ptlast ptnext ptprevious ptrewind ptselect put pwd py3do py3file python pydo pyfile quit quitall qall read recover redo redir redraw redrawstatus registers resize retab return rewind right rightbelow ruby rubydo rubyfile rundo runtime rviminfo substitute sNext sandbox sargument sall saveas sbuffer sbNext sball sbfirst sblast sbmodified sbnext sbprevious sbrewind scriptnames scriptencoding '
            + 'scscope set setfiletype setglobal setlocal sfind sfirst shell simalt sign silent sleep slast smagic smapclear smenu snext sniff snomagic snoremap snoremenu sort source spelldump spellgood spellinfo spellrepall spellundo spellwrong split sprevious srewind stop stag startgreplace startreplace '
            + 'startinsert stopinsert stjump stselect sunhide sunmap sunmenu suspend sview swapname syntax syntime syncbind tNext tabNext tabclose tabedit tabfind tabfirst tablast tabmove tabnext tabonly tabprevious tabrewind tag tcl tcldo tclfile tearoff tfirst throw tjump tlast tmenu tnext topleft tprevious ' + 'trewind tselect tunmenu undo undojoin undolist unabbreviate unhide unlet unlockvar unmap unmenu unsilent update vglobal version verbose vertical vimgrep vimgrepadd visual viusage view vmap vmapclear vmenu vnew '
            + 'vnoremap vnoremenu vsplit vunmap vunmenu write wNext wall while winsize wincmd winpos wnext wprevious wqall wsverb wundo wviminfo xit xall xmapclear xmap xmenu xnoremap xnoremenu xunmap xunmenu yank',
          built_in: // built in func
            'synIDtrans atan2 range matcharg did_filetype asin feedkeys xor argv '
            + 'complete_check add getwinposx getqflist getwinposy screencol '
            + 'clearmatches empty extend getcmdpos mzeval garbagecollect setreg '
            + 'ceil sqrt diff_hlID inputsecret get getfperm getpid filewritable '
            + 'shiftwidth max sinh isdirectory synID system inputrestore winline '
            + 'atan visualmode inputlist tabpagewinnr round getregtype mapcheck '
            + 'hasmapto histdel argidx findfile sha256 exists toupper getcmdline '
            + 'taglist string getmatches bufnr strftime winwidth bufexists '
            + 'strtrans tabpagebuflist setcmdpos remote_read printf setloclist '
            + 'getpos getline bufwinnr float2nr len getcmdtype diff_filler luaeval '
            + 'resolve libcallnr foldclosedend reverse filter has_key bufname '
            + 'str2float strlen setline getcharmod setbufvar index searchpos '
            + 'shellescape undofile foldclosed setqflist buflisted strchars str2nr '
            + 'virtcol floor remove undotree remote_expr winheight gettabwinvar '
            + 'reltime cursor tabpagenr finddir localtime acos getloclist search '
            + 'tanh matchend rename gettabvar strdisplaywidth type abs py3eval '
            + 'setwinvar tolower wildmenumode log10 spellsuggest bufloaded '
            + 'synconcealed nextnonblank server2client complete settabwinvar '
            + 'executable input wincol setmatches getftype hlID inputsave '
            + 'searchpair or screenrow line settabvar histadd deepcopy strpart '
            + 'remote_peek and eval getftime submatch screenchar winsaveview '
            + 'matchadd mkdir screenattr getfontname libcall reltimestr getfsize '
            + 'winnr invert pow getbufline byte2line soundfold repeat fnameescape '
            + 'tagfiles sin strwidth spellbadword trunc maparg log lispindent '
            + 'hostname setpos globpath remote_foreground getchar synIDattr '
            + 'fnamemodify cscope_connection stridx winbufnr indent min '
            + 'complete_add nr2char searchpairpos inputdialog values matchlist '
            + 'items hlexists strridx browsedir expand fmod pathshorten line2byte '
            + 'argc count getwinvar glob foldtextresult getreg foreground cosh '
            + 'matchdelete has char2nr simplify histget searchdecl iconv '
            + 'winrestcmd pumvisible writefile foldlevel haslocaldir keys cos '
            + 'matchstr foldtext histnr tan tempname getcwd byteidx getbufvar '
            + 'islocked escape eventhandler remote_send serverlist winrestview '
            + 'synstack pyeval prevnonblank readfile cindent filereadable changenr '
            + 'exp'
        },
        illegal: /;/,
        contains: [
          hljs.NUMBER_MODE,
          {
            className: 'string',
            begin: '\'',
            end: '\'',
            illegal: '\\n'
          },

          /*
          A double quote can start either a string or a line comment. Strings are
          ended before the end of a line by another double quote and can contain
          escaped double-quotes and post-escaped line breaks.

          Also, any double quote at the beginning of a line is a comment but we
          don't handle that properly at the moment: any double quote inside will
          turn them into a string. Handling it properly will require a smarter
          parser.
          */
          {
            className: 'string',
            begin: /"(\\"|\n\\|[^"\n])*"/
          },
          hljs.COMMENT('"', '$'),

          {
            className: 'variable',
            begin: /[bwtglsav]:[\w\d_]+/
          },
          {
            begin: [
              /\b(?:function|function!)/,
              /\s+/,
              hljs.IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "title"
            },
            end: '$',
            relevance: 0,
            contains: [
              {
                className: 'params',
                begin: '\\(',
                end: '\\)'
              }
            ]
          },
          {
            className: 'symbol',
            begin: /<[\w-]+>/
          }
        ]
      };
    }

    /*
    Language: WebAssembly
    Website: https://webassembly.org
    Description:  Wasm is designed as a portable compilation target for programming languages, enabling deployment on the web for client and server applications.
    Category: web, common
    Audit: 2020
    */

    /** @type LanguageFn */
    function wasm(hljs) {
      hljs.regex;
      const BLOCK_COMMENT = hljs.COMMENT(/\(;/, /;\)/);
      BLOCK_COMMENT.contains.push("self");
      const LINE_COMMENT = hljs.COMMENT(/;;/, /$/);

      const KWS = [
        "anyfunc",
        "block",
        "br",
        "br_if",
        "br_table",
        "call",
        "call_indirect",
        "data",
        "drop",
        "elem",
        "else",
        "end",
        "export",
        "func",
        "global.get",
        "global.set",
        "local.get",
        "local.set",
        "local.tee",
        "get_global",
        "get_local",
        "global",
        "if",
        "import",
        "local",
        "loop",
        "memory",
        "memory.grow",
        "memory.size",
        "module",
        "mut",
        "nop",
        "offset",
        "param",
        "result",
        "return",
        "select",
        "set_global",
        "set_local",
        "start",
        "table",
        "tee_local",
        "then",
        "type",
        "unreachable"
      ];

      const FUNCTION_REFERENCE = {
        begin: [
          /(?:func|call|call_indirect)/,
          /\s+/,
          /\$[^\s)]+/
        ],
        className: {
          1: "keyword",
          3: "title.function"
        }
      };

      const ARGUMENT = {
        className: "variable",
        begin: /\$[\w_]+/
      };

      const PARENS = {
        match: /(\((?!;)|\))+/,
        className: "punctuation",
        relevance: 0
      };

      const NUMBER = {
        className: "number",
        relevance: 0,
        // borrowed from Prism, TODO: split out into variants
        match: /[+-]?\b(?:\d(?:_?\d)*(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?|0x[\da-fA-F](?:_?[\da-fA-F])*(?:\.[\da-fA-F](?:_?[\da-fA-D])*)?(?:[pP][+-]?\d(?:_?\d)*)?)\b|\binf\b|\bnan(?::0x[\da-fA-F](?:_?[\da-fA-D])*)?\b/
      };

      const TYPE = {
        // look-ahead prevents us from gobbling up opcodes
        match: /(i32|i64|f32|f64)(?!\.)/,
        className: "type"
      };

      const MATH_OPERATIONS = {
        className: "keyword",
        // borrowed from Prism, TODO: split out into variants
        match: /\b(f32|f64|i32|i64)(?:\.(?:abs|add|and|ceil|clz|const|convert_[su]\/i(?:32|64)|copysign|ctz|demote\/f64|div(?:_[su])?|eqz?|extend_[su]\/i32|floor|ge(?:_[su])?|gt(?:_[su])?|le(?:_[su])?|load(?:(?:8|16|32)_[su])?|lt(?:_[su])?|max|min|mul|nearest|neg?|or|popcnt|promote\/f32|reinterpret\/[fi](?:32|64)|rem_[su]|rot[lr]|shl|shr_[su]|store(?:8|16|32)?|sqrt|sub|trunc(?:_[su]\/f(?:32|64))?|wrap\/i64|xor))\b/
      };

      const OFFSET_ALIGN = {
        match: [
          /(?:offset|align)/,
          /\s*/,
          /=/
        ],
        className: {
          1: "keyword",
          3: "operator"
        }
      };

      return {
        name: 'WebAssembly',
        keywords: {
          $pattern: /[\w.]+/,
          keyword: KWS
        },
        contains: [
          LINE_COMMENT,
          BLOCK_COMMENT,
          OFFSET_ALIGN,
          ARGUMENT,
          PARENS,
          FUNCTION_REFERENCE,
          hljs.QUOTE_STRING_MODE,
          TYPE,
          MATH_OPERATIONS,
          NUMBER
        ]
      };
    }

    /*
    Language: Wren
    Description: Think Smalltalk in a Lua-sized package with a dash of Erlang and wrapped up in a familiar, modern syntax.
    Category: scripting
    Author: @joshgoebel
    Maintainer: @joshgoebel
    Website: https://wren.io/
    */

    /** @type LanguageFn */
    function wren(hljs) {
      const regex = hljs.regex;
      const IDENT_RE = /[a-zA-Z]\w*/;
      const KEYWORDS = [
        "as",
        "break",
        "class",
        "construct",
        "continue",
        "else",
        "for",
        "foreign",
        "if",
        "import",
        "in",
        "is",
        "return",
        "static",
        "var",
        "while"
      ];
      const LITERALS = [
        "true",
        "false",
        "null"
      ];
      const LANGUAGE_VARS = [
        "this",
        "super"
      ];
      const CORE_CLASSES = [
        "Bool",
        "Class",
        "Fiber",
        "Fn",
        "List",
        "Map",
        "Null",
        "Num",
        "Object",
        "Range",
        "Sequence",
        "String",
        "System"
      ];
      const OPERATORS = [
        "-",
        "~",
        /\*/,
        "%",
        /\.\.\./,
        /\.\./,
        /\+/,
        "<<",
        ">>",
        ">=",
        "<=",
        "<",
        ">",
        /\^/,
        /!=/,
        /!/,
        /\bis\b/,
        "==",
        "&&",
        "&",
        /\|\|/,
        /\|/,
        /\?:/,
        "="
      ];
      const FUNCTION = {
        relevance: 0,
        match: regex.concat(/\b(?!(if|while|for|else|super)\b)/, IDENT_RE, /(?=\s*[({])/),
        className: "title.function"
      };
      const FUNCTION_DEFINITION = {
        match: regex.concat(
          regex.either(
            regex.concat(/\b(?!(if|while|for|else|super)\b)/, IDENT_RE),
            regex.either(...OPERATORS)
          ),
          /(?=\s*\([^)]+\)\s*\{)/),
        className: "title.function",
        starts: { contains: [
          {
            begin: /\(/,
            end: /\)/,
            contains: [
              {
                relevance: 0,
                scope: "params",
                match: IDENT_RE
              }
            ]
          }
        ] }
      };
      const CLASS_DEFINITION = {
        variants: [
          { match: [
            /class\s+/,
            IDENT_RE,
            /\s+is\s+/,
            IDENT_RE
          ] },
          { match: [
            /class\s+/,
            IDENT_RE
          ] }
        ],
        scope: {
          2: "title.class",
          4: "title.class.inherited"
        },
        keywords: KEYWORDS
      };

      const OPERATOR = {
        relevance: 0,
        match: regex.either(...OPERATORS),
        className: "operator"
      };

      const TRIPLE_STRING = {
        className: "string",
        begin: /"""/,
        end: /"""/
      };

      const PROPERTY = {
        className: "property",
        begin: regex.concat(/\./, regex.lookahead(IDENT_RE)),
        end: IDENT_RE,
        excludeBegin: true,
        relevance: 0
      };

      const FIELD = {
        relevance: 0,
        match: regex.concat(/\b_/, IDENT_RE),
        scope: "variable"
      };

      // CamelCase
      const CLASS_REFERENCE = {
        relevance: 0,
        match: /\b[A-Z]+[a-z]+([A-Z]+[a-z]+)*/,
        scope: "title.class",
        keywords: { _: CORE_CLASSES }
      };

      // TODO: add custom number modes
      const NUMBER = hljs.C_NUMBER_MODE;

      const SETTER = {
        match: [
          IDENT_RE,
          /\s*/,
          /=/,
          /\s*/,
          /\(/,
          IDENT_RE,
          /\)\s*\{/
        ],
        scope: {
          1: "title.function",
          3: "operator",
          6: "params"
        }
      };

      const COMMENT_DOCS = hljs.COMMENT(
        /\/\*\*/,
        /\*\//,
        { contains: [
          {
            match: /@[a-z]+/,
            scope: "doctag"
          },
          "self"
        ] }
      );
      const SUBST = {
        scope: "subst",
        begin: /%\(/,
        end: /\)/,
        contains: [
          NUMBER,
          CLASS_REFERENCE,
          FUNCTION,
          FIELD,
          OPERATOR
        ]
      };
      const STRING = {
        scope: "string",
        begin: /"/,
        end: /"/,
        contains: [
          SUBST,
          {
            scope: "char.escape",
            variants: [
              { match: /\\\\|\\["0%abefnrtv]/ },
              { match: /\\x[0-9A-F]{2}/ },
              { match: /\\u[0-9A-F]{4}/ },
              { match: /\\U[0-9A-F]{8}/ }
            ]
          }
        ]
      };
      SUBST.contains.push(STRING);

      const ALL_KWS = [
        ...KEYWORDS,
        ...LANGUAGE_VARS,
        ...LITERALS
      ];
      const VARIABLE = {
        relevance: 0,
        match: regex.concat(
          "\\b(?!",
          ALL_KWS.join("|"),
          "\\b)",
          /[a-zA-Z_]\w*(?:[?!]|\b)/
        ),
        className: "variable"
      };

      // TODO: reconsider this in the future
      const ATTRIBUTE = {
        // scope: "meta",
        scope: "comment",
        variants: [
          {
            begin: [
              /#!?/,
              /[A-Za-z_]+(?=\()/
            ],
            beginScope: {
              // 2: "attr"
            },
            keywords: { literal: LITERALS },
            contains: [
              // NUMBER,
              // VARIABLE
            ],
            end: /\)/
          },
          {
            begin: [
              /#!?/,
              /[A-Za-z_]+/
            ],
            beginScope: {
              // 2: "attr"
            },
            end: /$/
          }
        ]
      };

      return {
        name: "Wren",
        keywords: {
          keyword: KEYWORDS,
          "variable.language": LANGUAGE_VARS,
          literal: LITERALS
        },
        contains: [
          ATTRIBUTE,
          NUMBER,
          STRING,
          TRIPLE_STRING,
          COMMENT_DOCS,
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          CLASS_REFERENCE,
          CLASS_DEFINITION,
          SETTER,
          FUNCTION_DEFINITION,
          FUNCTION,
          OPERATOR,
          FIELD,
          PROPERTY,
          VARIABLE
        ]
      };
    }

    /*
    Language: Intel x86 Assembly
    Author: innocenat <innocenat@gmail.com>
    Description: x86 assembly language using Intel's mnemonic and NASM syntax
    Website: https://en.wikipedia.org/wiki/X86_assembly_language
    Category: assembler
    */

    function x86asm(hljs) {
      return {
        name: 'Intel x86 Assembly',
        case_insensitive: true,
        keywords: {
          $pattern: '[.%]?' + hljs.IDENT_RE,
          keyword:
            'lock rep repe repz repne repnz xaquire xrelease bnd nobnd '
            + 'aaa aad aam aas adc add and arpl bb0_reset bb1_reset bound bsf bsr bswap bt btc btr bts call cbw cdq cdqe clc cld cli clts cmc cmp cmpsb cmpsd cmpsq cmpsw cmpxchg cmpxchg486 cmpxchg8b cmpxchg16b cpuid cpu_read cpu_write cqo cwd cwde daa das dec div dmint emms enter equ f2xm1 fabs fadd faddp fbld fbstp fchs fclex fcmovb fcmovbe fcmove fcmovnb fcmovnbe fcmovne fcmovnu fcmovu fcom fcomi fcomip fcomp fcompp fcos fdecstp fdisi fdiv fdivp fdivr fdivrp femms feni ffree ffreep fiadd ficom ficomp fidiv fidivr fild fimul fincstp finit fist fistp fisttp fisub fisubr fld fld1 fldcw fldenv fldl2e fldl2t fldlg2 fldln2 fldpi fldz fmul fmulp fnclex fndisi fneni fninit fnop fnsave fnstcw fnstenv fnstsw fpatan fprem fprem1 fptan frndint frstor fsave fscale fsetpm fsin fsincos fsqrt fst fstcw fstenv fstp fstsw fsub fsubp fsubr fsubrp ftst fucom fucomi fucomip fucomp fucompp fxam fxch fxtract fyl2x fyl2xp1 hlt ibts icebp idiv imul in inc incbin insb insd insw int int01 int1 int03 int3 into invd invpcid invlpg invlpga iret iretd iretq iretw jcxz jecxz jrcxz jmp jmpe lahf lar lds lea leave les lfence lfs lgdt lgs lidt lldt lmsw loadall loadall286 lodsb lodsd lodsq lodsw loop loope loopne loopnz loopz lsl lss ltr mfence monitor mov movd movq movsb movsd movsq movsw movsx movsxd movzx mul mwait neg nop not or out outsb outsd outsw packssdw packsswb packuswb paddb paddd paddsb paddsiw paddsw paddusb paddusw paddw pand pandn pause paveb pavgusb pcmpeqb pcmpeqd pcmpeqw pcmpgtb pcmpgtd pcmpgtw pdistib pf2id pfacc pfadd pfcmpeq pfcmpge pfcmpgt pfmax pfmin pfmul pfrcp pfrcpit1 pfrcpit2 pfrsqit1 pfrsqrt pfsub pfsubr pi2fd pmachriw pmaddwd pmagw pmulhriw pmulhrwa pmulhrwc pmulhw pmullw pmvgezb pmvlzb pmvnzb pmvzb pop popa popad popaw popf popfd popfq popfw por prefetch prefetchw pslld psllq psllw psrad psraw psrld psrlq psrlw psubb psubd psubsb psubsiw psubsw psubusb psubusw psubw punpckhbw punpckhdq punpckhwd punpcklbw punpckldq punpcklwd push pusha pushad pushaw pushf pushfd pushfq pushfw pxor rcl rcr rdshr rdmsr rdpmc rdtsc rdtscp ret retf retn rol ror rdm rsdc rsldt rsm rsts sahf sal salc sar sbb scasb scasd scasq scasw sfence sgdt shl shld shr shrd sidt sldt skinit smi smint smintold smsw stc std sti stosb stosd stosq stosw str sub svdc svldt svts swapgs syscall sysenter sysexit sysret test ud0 ud1 ud2b ud2 ud2a umov verr verw fwait wbinvd wrshr wrmsr xadd xbts xchg xlatb xlat xor cmove cmovz cmovne cmovnz cmova cmovnbe cmovae cmovnb cmovb cmovnae cmovbe cmovna cmovg cmovnle cmovge cmovnl cmovl cmovnge cmovle cmovng cmovc cmovnc cmovo cmovno cmovs cmovns cmovp cmovpe cmovnp cmovpo je jz jne jnz ja jnbe jae jnb jb jnae jbe jna jg jnle jge jnl jl jnge jle jng jc jnc jo jno js jns jpo jnp jpe jp sete setz setne setnz seta setnbe setae setnb setnc setb setnae setcset setbe setna setg setnle setge setnl setl setnge setle setng sets setns seto setno setpe setp setpo setnp addps addss andnps andps cmpeqps cmpeqss cmpleps cmpless cmpltps cmpltss cmpneqps cmpneqss cmpnleps cmpnless cmpnltps cmpnltss cmpordps cmpordss cmpunordps cmpunordss cmpps cmpss comiss cvtpi2ps cvtps2pi cvtsi2ss cvtss2si cvttps2pi cvttss2si divps divss ldmxcsr maxps maxss minps minss movaps movhps movlhps movlps movhlps movmskps movntps movss movups mulps mulss orps rcpps rcpss rsqrtps rsqrtss shufps sqrtps sqrtss stmxcsr subps subss ucomiss unpckhps unpcklps xorps fxrstor fxrstor64 fxsave fxsave64 xgetbv xsetbv xsave xsave64 xsaveopt xsaveopt64 xrstor xrstor64 prefetchnta prefetcht0 prefetcht1 prefetcht2 maskmovq movntq pavgb pavgw pextrw pinsrw pmaxsw pmaxub pminsw pminub pmovmskb pmulhuw psadbw pshufw pf2iw pfnacc pfpnacc pi2fw pswapd maskmovdqu clflush movntdq movnti movntpd movdqa movdqu movdq2q movq2dq paddq pmuludq pshufd pshufhw pshuflw pslldq psrldq psubq punpckhqdq punpcklqdq addpd addsd andnpd andpd cmpeqpd cmpeqsd cmplepd cmplesd cmpltpd cmpltsd cmpneqpd cmpneqsd cmpnlepd cmpnlesd cmpnltpd cmpnltsd cmpordpd cmpordsd cmpunordpd cmpunordsd cmppd comisd cvtdq2pd cvtdq2ps cvtpd2dq cvtpd2pi cvtpd2ps cvtpi2pd cvtps2dq cvtps2pd cvtsd2si cvtsd2ss cvtsi2sd cvtss2sd cvttpd2pi cvttpd2dq cvttps2dq cvttsd2si divpd divsd maxpd maxsd minpd minsd movapd movhpd movlpd movmskpd movupd mulpd mulsd orpd shufpd sqrtpd sqrtsd subpd subsd ucomisd unpckhpd unpcklpd xorpd addsubpd addsubps haddpd haddps hsubpd hsubps lddqu movddup movshdup movsldup clgi stgi vmcall vmclear vmfunc vmlaunch vmload vmmcall vmptrld vmptrst vmread vmresume vmrun vmsave vmwrite vmxoff vmxon invept invvpid pabsb pabsw pabsd palignr phaddw phaddd phaddsw phsubw phsubd phsubsw pmaddubsw pmulhrsw pshufb psignb psignw psignd extrq insertq movntsd movntss lzcnt blendpd blendps blendvpd blendvps dppd dpps extractps insertps movntdqa mpsadbw packusdw pblendvb pblendw pcmpeqq pextrb pextrd pextrq phminposuw pinsrb pinsrd pinsrq pmaxsb pmaxsd pmaxud pmaxuw pminsb pminsd pminud pminuw pmovsxbw pmovsxbd pmovsxbq pmovsxwd pmovsxwq pmovsxdq pmovzxbw pmovzxbd pmovzxbq pmovzxwd pmovzxwq pmovzxdq pmuldq pmulld ptest roundpd roundps roundsd roundss crc32 pcmpestri pcmpestrm pcmpistri pcmpistrm pcmpgtq popcnt getsec pfrcpv pfrsqrtv movbe aesenc aesenclast aesdec aesdeclast aesimc aeskeygenassist vaesenc vaesenclast vaesdec vaesdeclast vaesimc vaeskeygenassist vaddpd vaddps vaddsd vaddss vaddsubpd vaddsubps vandpd vandps vandnpd vandnps vblendpd vblendps vblendvpd vblendvps vbroadcastss vbroadcastsd vbroadcastf128 vcmpeq_ospd vcmpeqpd vcmplt_ospd vcmpltpd vcmple_ospd vcmplepd vcmpunord_qpd vcmpunordpd vcmpneq_uqpd vcmpneqpd vcmpnlt_uspd vcmpnltpd vcmpnle_uspd vcmpnlepd vcmpord_qpd vcmpordpd vcmpeq_uqpd vcmpnge_uspd vcmpngepd vcmpngt_uspd vcmpngtpd vcmpfalse_oqpd vcmpfalsepd vcmpneq_oqpd vcmpge_ospd vcmpgepd vcmpgt_ospd vcmpgtpd vcmptrue_uqpd vcmptruepd vcmplt_oqpd vcmple_oqpd vcmpunord_spd vcmpneq_uspd vcmpnlt_uqpd vcmpnle_uqpd vcmpord_spd vcmpeq_uspd vcmpnge_uqpd vcmpngt_uqpd vcmpfalse_ospd vcmpneq_ospd vcmpge_oqpd vcmpgt_oqpd vcmptrue_uspd vcmppd vcmpeq_osps vcmpeqps vcmplt_osps vcmpltps vcmple_osps vcmpleps vcmpunord_qps vcmpunordps vcmpneq_uqps vcmpneqps vcmpnlt_usps vcmpnltps vcmpnle_usps vcmpnleps vcmpord_qps vcmpordps vcmpeq_uqps vcmpnge_usps vcmpngeps vcmpngt_usps vcmpngtps vcmpfalse_oqps vcmpfalseps vcmpneq_oqps vcmpge_osps vcmpgeps vcmpgt_osps vcmpgtps vcmptrue_uqps vcmptrueps vcmplt_oqps vcmple_oqps vcmpunord_sps vcmpneq_usps vcmpnlt_uqps vcmpnle_uqps vcmpord_sps vcmpeq_usps vcmpnge_uqps vcmpngt_uqps vcmpfalse_osps vcmpneq_osps vcmpge_oqps vcmpgt_oqps vcmptrue_usps vcmpps vcmpeq_ossd vcmpeqsd vcmplt_ossd vcmpltsd vcmple_ossd vcmplesd vcmpunord_qsd vcmpunordsd vcmpneq_uqsd vcmpneqsd vcmpnlt_ussd vcmpnltsd vcmpnle_ussd vcmpnlesd vcmpord_qsd vcmpordsd vcmpeq_uqsd vcmpnge_ussd vcmpngesd vcmpngt_ussd vcmpngtsd vcmpfalse_oqsd vcmpfalsesd vcmpneq_oqsd vcmpge_ossd vcmpgesd vcmpgt_ossd vcmpgtsd vcmptrue_uqsd vcmptruesd vcmplt_oqsd vcmple_oqsd vcmpunord_ssd vcmpneq_ussd vcmpnlt_uqsd vcmpnle_uqsd vcmpord_ssd vcmpeq_ussd vcmpnge_uqsd vcmpngt_uqsd vcmpfalse_ossd vcmpneq_ossd vcmpge_oqsd vcmpgt_oqsd vcmptrue_ussd vcmpsd vcmpeq_osss vcmpeqss vcmplt_osss vcmpltss vcmple_osss vcmpless vcmpunord_qss vcmpunordss vcmpneq_uqss vcmpneqss vcmpnlt_usss vcmpnltss vcmpnle_usss vcmpnless vcmpord_qss vcmpordss vcmpeq_uqss vcmpnge_usss vcmpngess vcmpngt_usss vcmpngtss vcmpfalse_oqss vcmpfalsess vcmpneq_oqss vcmpge_osss vcmpgess vcmpgt_osss vcmpgtss vcmptrue_uqss vcmptruess vcmplt_oqss vcmple_oqss vcmpunord_sss vcmpneq_usss vcmpnlt_uqss vcmpnle_uqss vcmpord_sss vcmpeq_usss vcmpnge_uqss vcmpngt_uqss vcmpfalse_osss vcmpneq_osss vcmpge_oqss vcmpgt_oqss vcmptrue_usss vcmpss vcomisd vcomiss vcvtdq2pd vcvtdq2ps vcvtpd2dq vcvtpd2ps vcvtps2dq vcvtps2pd vcvtsd2si vcvtsd2ss vcvtsi2sd vcvtsi2ss vcvtss2sd vcvtss2si vcvttpd2dq vcvttps2dq vcvttsd2si vcvttss2si vdivpd vdivps vdivsd vdivss vdppd vdpps vextractf128 vextractps vhaddpd vhaddps vhsubpd vhsubps vinsertf128 vinsertps vlddqu vldqqu vldmxcsr vmaskmovdqu vmaskmovps vmaskmovpd vmaxpd vmaxps vmaxsd vmaxss vminpd vminps vminsd vminss vmovapd vmovaps vmovd vmovq vmovddup vmovdqa vmovqqa vmovdqu vmovqqu vmovhlps vmovhpd vmovhps vmovlhps vmovlpd vmovlps vmovmskpd vmovmskps vmovntdq vmovntqq vmovntdqa vmovntpd vmovntps vmovsd vmovshdup vmovsldup vmovss vmovupd vmovups vmpsadbw vmulpd vmulps vmulsd vmulss vorpd vorps vpabsb vpabsw vpabsd vpacksswb vpackssdw vpackuswb vpackusdw vpaddb vpaddw vpaddd vpaddq vpaddsb vpaddsw vpaddusb vpaddusw vpalignr vpand vpandn vpavgb vpavgw vpblendvb vpblendw vpcmpestri vpcmpestrm vpcmpistri vpcmpistrm vpcmpeqb vpcmpeqw vpcmpeqd vpcmpeqq vpcmpgtb vpcmpgtw vpcmpgtd vpcmpgtq vpermilpd vpermilps vperm2f128 vpextrb vpextrw vpextrd vpextrq vphaddw vphaddd vphaddsw vphminposuw vphsubw vphsubd vphsubsw vpinsrb vpinsrw vpinsrd vpinsrq vpmaddwd vpmaddubsw vpmaxsb vpmaxsw vpmaxsd vpmaxub vpmaxuw vpmaxud vpminsb vpminsw vpminsd vpminub vpminuw vpminud vpmovmskb vpmovsxbw vpmovsxbd vpmovsxbq vpmovsxwd vpmovsxwq vpmovsxdq vpmovzxbw vpmovzxbd vpmovzxbq vpmovzxwd vpmovzxwq vpmovzxdq vpmulhuw vpmulhrsw vpmulhw vpmullw vpmulld vpmuludq vpmuldq vpor vpsadbw vpshufb vpshufd vpshufhw vpshuflw vpsignb vpsignw vpsignd vpslldq vpsrldq vpsllw vpslld vpsllq vpsraw vpsrad vpsrlw vpsrld vpsrlq vptest vpsubb vpsubw vpsubd vpsubq vpsubsb vpsubsw vpsubusb vpsubusw vpunpckhbw vpunpckhwd vpunpckhdq vpunpckhqdq vpunpcklbw vpunpcklwd vpunpckldq vpunpcklqdq vpxor vrcpps vrcpss vrsqrtps vrsqrtss vroundpd vroundps vroundsd vroundss vshufpd vshufps vsqrtpd vsqrtps vsqrtsd vsqrtss vstmxcsr vsubpd vsubps vsubsd vsubss vtestps vtestpd vucomisd vucomiss vunpckhpd vunpckhps vunpcklpd vunpcklps vxorpd vxorps vzeroall vzeroupper pclmullqlqdq pclmulhqlqdq pclmullqhqdq pclmulhqhqdq pclmulqdq vpclmullqlqdq vpclmulhqlqdq vpclmullqhqdq vpclmulhqhqdq vpclmulqdq vfmadd132ps vfmadd132pd vfmadd312ps vfmadd312pd vfmadd213ps vfmadd213pd vfmadd123ps vfmadd123pd vfmadd231ps vfmadd231pd vfmadd321ps vfmadd321pd vfmaddsub132ps vfmaddsub132pd vfmaddsub312ps vfmaddsub312pd vfmaddsub213ps vfmaddsub213pd vfmaddsub123ps vfmaddsub123pd vfmaddsub231ps vfmaddsub231pd vfmaddsub321ps vfmaddsub321pd vfmsub132ps vfmsub132pd vfmsub312ps vfmsub312pd vfmsub213ps vfmsub213pd vfmsub123ps vfmsub123pd vfmsub231ps vfmsub231pd vfmsub321ps vfmsub321pd vfmsubadd132ps vfmsubadd132pd vfmsubadd312ps vfmsubadd312pd vfmsubadd213ps vfmsubadd213pd vfmsubadd123ps vfmsubadd123pd vfmsubadd231ps vfmsubadd231pd vfmsubadd321ps vfmsubadd321pd vfnmadd132ps vfnmadd132pd vfnmadd312ps vfnmadd312pd vfnmadd213ps vfnmadd213pd vfnmadd123ps vfnmadd123pd vfnmadd231ps vfnmadd231pd vfnmadd321ps vfnmadd321pd vfnmsub132ps vfnmsub132pd vfnmsub312ps vfnmsub312pd vfnmsub213ps vfnmsub213pd vfnmsub123ps vfnmsub123pd vfnmsub231ps vfnmsub231pd vfnmsub321ps vfnmsub321pd vfmadd132ss vfmadd132sd vfmadd312ss vfmadd312sd vfmadd213ss vfmadd213sd vfmadd123ss vfmadd123sd vfmadd231ss vfmadd231sd vfmadd321ss vfmadd321sd vfmsub132ss vfmsub132sd vfmsub312ss vfmsub312sd vfmsub213ss vfmsub213sd vfmsub123ss vfmsub123sd vfmsub231ss vfmsub231sd vfmsub321ss vfmsub321sd vfnmadd132ss vfnmadd132sd vfnmadd312ss vfnmadd312sd vfnmadd213ss vfnmadd213sd vfnmadd123ss vfnmadd123sd vfnmadd231ss vfnmadd231sd vfnmadd321ss vfnmadd321sd vfnmsub132ss vfnmsub132sd vfnmsub312ss vfnmsub312sd vfnmsub213ss vfnmsub213sd vfnmsub123ss vfnmsub123sd vfnmsub231ss vfnmsub231sd vfnmsub321ss vfnmsub321sd rdfsbase rdgsbase rdrand wrfsbase wrgsbase vcvtph2ps vcvtps2ph adcx adox rdseed clac stac xstore xcryptecb xcryptcbc xcryptctr xcryptcfb xcryptofb montmul xsha1 xsha256 llwpcb slwpcb lwpval lwpins vfmaddpd vfmaddps vfmaddsd vfmaddss vfmaddsubpd vfmaddsubps vfmsubaddpd vfmsubaddps vfmsubpd vfmsubps vfmsubsd vfmsubss vfnmaddpd vfnmaddps vfnmaddsd vfnmaddss vfnmsubpd vfnmsubps vfnmsubsd vfnmsubss vfrczpd vfrczps vfrczsd vfrczss vpcmov vpcomb vpcomd vpcomq vpcomub vpcomud vpcomuq vpcomuw vpcomw vphaddbd vphaddbq vphaddbw vphadddq vphaddubd vphaddubq vphaddubw vphaddudq vphadduwd vphadduwq vphaddwd vphaddwq vphsubbw vphsubdq vphsubwd vpmacsdd vpmacsdqh vpmacsdql vpmacssdd vpmacssdqh vpmacssdql vpmacsswd vpmacssww vpmacswd vpmacsww vpmadcsswd vpmadcswd vpperm vprotb vprotd vprotq vprotw vpshab vpshad vpshaq vpshaw vpshlb vpshld vpshlq vpshlw vbroadcasti128 vpblendd vpbroadcastb vpbroadcastw vpbroadcastd vpbroadcastq vpermd vpermpd vpermps vpermq vperm2i128 vextracti128 vinserti128 vpmaskmovd vpmaskmovq vpsllvd vpsllvq vpsravd vpsrlvd vpsrlvq vgatherdpd vgatherqpd vgatherdps vgatherqps vpgatherdd vpgatherqd vpgatherdq vpgatherqq xabort xbegin xend xtest andn bextr blci blcic blsi blsic blcfill blsfill blcmsk blsmsk blsr blcs bzhi mulx pdep pext rorx sarx shlx shrx tzcnt tzmsk t1mskc valignd valignq vblendmpd vblendmps vbroadcastf32x4 vbroadcastf64x4 vbroadcasti32x4 vbroadcasti64x4 vcompresspd vcompressps vcvtpd2udq vcvtps2udq vcvtsd2usi vcvtss2usi vcvttpd2udq vcvttps2udq vcvttsd2usi vcvttss2usi vcvtudq2pd vcvtudq2ps vcvtusi2sd vcvtusi2ss vexpandpd vexpandps vextractf32x4 vextractf64x4 vextracti32x4 vextracti64x4 vfixupimmpd vfixupimmps vfixupimmsd vfixupimmss vgetexppd vgetexpps vgetexpsd vgetexpss vgetmantpd vgetmantps vgetmantsd vgetmantss vinsertf32x4 vinsertf64x4 vinserti32x4 vinserti64x4 vmovdqa32 vmovdqa64 vmovdqu32 vmovdqu64 vpabsq vpandd vpandnd vpandnq vpandq vpblendmd vpblendmq vpcmpltd vpcmpled vpcmpneqd vpcmpnltd vpcmpnled vpcmpd vpcmpltq vpcmpleq vpcmpneqq vpcmpnltq vpcmpnleq vpcmpq vpcmpequd vpcmpltud vpcmpleud vpcmpnequd vpcmpnltud vpcmpnleud vpcmpud vpcmpequq vpcmpltuq vpcmpleuq vpcmpnequq vpcmpnltuq vpcmpnleuq vpcmpuq vpcompressd vpcompressq vpermi2d vpermi2pd vpermi2ps vpermi2q vpermt2d vpermt2pd vpermt2ps vpermt2q vpexpandd vpexpandq vpmaxsq vpmaxuq vpminsq vpminuq vpmovdb vpmovdw vpmovqb vpmovqd vpmovqw vpmovsdb vpmovsdw vpmovsqb vpmovsqd vpmovsqw vpmovusdb vpmovusdw vpmovusqb vpmovusqd vpmovusqw vpord vporq vprold vprolq vprolvd vprolvq vprord vprorq vprorvd vprorvq vpscatterdd vpscatterdq vpscatterqd vpscatterqq vpsraq vpsravq vpternlogd vpternlogq vptestmd vptestmq vptestnmd vptestnmq vpxord vpxorq vrcp14pd vrcp14ps vrcp14sd vrcp14ss vrndscalepd vrndscaleps vrndscalesd vrndscaless vrsqrt14pd vrsqrt14ps vrsqrt14sd vrsqrt14ss vscalefpd vscalefps vscalefsd vscalefss vscatterdpd vscatterdps vscatterqpd vscatterqps vshuff32x4 vshuff64x2 vshufi32x4 vshufi64x2 kandnw kandw kmovw knotw kortestw korw kshiftlw kshiftrw kunpckbw kxnorw kxorw vpbroadcastmb2q vpbroadcastmw2d vpconflictd vpconflictq vplzcntd vplzcntq vexp2pd vexp2ps vrcp28pd vrcp28ps vrcp28sd vrcp28ss vrsqrt28pd vrsqrt28ps vrsqrt28sd vrsqrt28ss vgatherpf0dpd vgatherpf0dps vgatherpf0qpd vgatherpf0qps vgatherpf1dpd vgatherpf1dps vgatherpf1qpd vgatherpf1qps vscatterpf0dpd vscatterpf0dps vscatterpf0qpd vscatterpf0qps vscatterpf1dpd vscatterpf1dps vscatterpf1qpd vscatterpf1qps prefetchwt1 bndmk bndcl bndcu bndcn bndmov bndldx bndstx sha1rnds4 sha1nexte sha1msg1 sha1msg2 sha256rnds2 sha256msg1 sha256msg2 hint_nop0 hint_nop1 hint_nop2 hint_nop3 hint_nop4 hint_nop5 hint_nop6 hint_nop7 hint_nop8 hint_nop9 hint_nop10 hint_nop11 hint_nop12 hint_nop13 hint_nop14 hint_nop15 hint_nop16 hint_nop17 hint_nop18 hint_nop19 hint_nop20 hint_nop21 hint_nop22 hint_nop23 hint_nop24 hint_nop25 hint_nop26 hint_nop27 hint_nop28 hint_nop29 hint_nop30 hint_nop31 hint_nop32 hint_nop33 hint_nop34 hint_nop35 hint_nop36 hint_nop37 hint_nop38 hint_nop39 hint_nop40 hint_nop41 hint_nop42 hint_nop43 hint_nop44 hint_nop45 hint_nop46 hint_nop47 hint_nop48 hint_nop49 hint_nop50 hint_nop51 hint_nop52 hint_nop53 hint_nop54 hint_nop55 hint_nop56 hint_nop57 hint_nop58 hint_nop59 hint_nop60 hint_nop61 hint_nop62 hint_nop63',
          built_in:
            // Instruction pointer
            'ip eip rip '
            // 8-bit registers
            + 'al ah bl bh cl ch dl dh sil dil bpl spl r8b r9b r10b r11b r12b r13b r14b r15b '
            // 16-bit registers
            + 'ax bx cx dx si di bp sp r8w r9w r10w r11w r12w r13w r14w r15w '
            // 32-bit registers
            + 'eax ebx ecx edx esi edi ebp esp eip r8d r9d r10d r11d r12d r13d r14d r15d '
            // 64-bit registers
            + 'rax rbx rcx rdx rsi rdi rbp rsp r8 r9 r10 r11 r12 r13 r14 r15 '
            // Segment registers
            + 'cs ds es fs gs ss '
            // Floating point stack registers
            + 'st st0 st1 st2 st3 st4 st5 st6 st7 '
            // MMX Registers
            + 'mm0 mm1 mm2 mm3 mm4 mm5 mm6 mm7 '
            // SSE registers
            + 'xmm0  xmm1  xmm2  xmm3  xmm4  xmm5  xmm6  xmm7  xmm8  xmm9 xmm10  xmm11 xmm12 xmm13 xmm14 xmm15 '
            + 'xmm16 xmm17 xmm18 xmm19 xmm20 xmm21 xmm22 xmm23 xmm24 xmm25 xmm26 xmm27 xmm28 xmm29 xmm30 xmm31 '
            // AVX registers
            + 'ymm0  ymm1  ymm2  ymm3  ymm4  ymm5  ymm6  ymm7  ymm8  ymm9 ymm10  ymm11 ymm12 ymm13 ymm14 ymm15 '
            + 'ymm16 ymm17 ymm18 ymm19 ymm20 ymm21 ymm22 ymm23 ymm24 ymm25 ymm26 ymm27 ymm28 ymm29 ymm30 ymm31 '
            // AVX-512F registers
            + 'zmm0  zmm1  zmm2  zmm3  zmm4  zmm5  zmm6  zmm7  zmm8  zmm9 zmm10  zmm11 zmm12 zmm13 zmm14 zmm15 '
            + 'zmm16 zmm17 zmm18 zmm19 zmm20 zmm21 zmm22 zmm23 zmm24 zmm25 zmm26 zmm27 zmm28 zmm29 zmm30 zmm31 '
            // AVX-512F mask registers
            + 'k0 k1 k2 k3 k4 k5 k6 k7 '
            // Bound (MPX) register
            + 'bnd0 bnd1 bnd2 bnd3 '
            // Special register
            + 'cr0 cr1 cr2 cr3 cr4 cr8 dr0 dr1 dr2 dr3 dr8 tr3 tr4 tr5 tr6 tr7 '
            // NASM altreg package
            + 'r0 r1 r2 r3 r4 r5 r6 r7 r0b r1b r2b r3b r4b r5b r6b r7b '
            + 'r0w r1w r2w r3w r4w r5w r6w r7w r0d r1d r2d r3d r4d r5d r6d r7d '
            + 'r0h r1h r2h r3h '
            + 'r0l r1l r2l r3l r4l r5l r6l r7l r8l r9l r10l r11l r12l r13l r14l r15l '

            + 'db dw dd dq dt ddq do dy dz '
            + 'resb resw resd resq rest resdq reso resy resz '
            + 'incbin equ times '
            + 'byte word dword qword nosplit rel abs seg wrt strict near far a32 ptr',

          meta:
            '%define %xdefine %+ %undef %defstr %deftok %assign %strcat %strlen %substr %rotate %elif %else %endif '
            + '%if %ifmacro %ifctx %ifidn %ifidni %ifid %ifnum %ifstr %iftoken %ifempty %ifenv %error %warning %fatal %rep '
            + '%endrep %include %push %pop %repl %pathsearch %depend %use %arg %stacksize %local %line %comment %endcomment '
            + '.nolist '
            + '__FILE__ __LINE__ __SECT__  __BITS__ __OUTPUT_FORMAT__ __DATE__ __TIME__ __DATE_NUM__ __TIME_NUM__ '
            + '__UTC_DATE__ __UTC_TIME__ __UTC_DATE_NUM__ __UTC_TIME_NUM__  __PASS__ struc endstruc istruc at iend '
            + 'align alignb sectalign daz nodaz up down zero default option assume public '

            + 'bits use16 use32 use64 default section segment absolute extern global common cpu float '
            + '__utf16__ __utf16le__ __utf16be__ __utf32__ __utf32le__ __utf32be__ '
            + '__float8__ __float16__ __float32__ __float64__ __float80m__ __float80e__ __float128l__ __float128h__ '
            + '__Infinity__ __QNaN__ __SNaN__ Inf NaN QNaN SNaN float8 float16 float32 float64 float80m float80e '
            + 'float128l float128h __FLOAT_DAZ__ __FLOAT_ROUND__ __FLOAT__'
        },
        contains: [
          hljs.COMMENT(
            ';',
            '$',
            { relevance: 0 }
          ),
          {
            className: 'number',
            variants: [
              // Float number and x87 BCD
              {
                begin: '\\b(?:([0-9][0-9_]*)?\\.[0-9_]*(?:[eE][+-]?[0-9_]+)?|'
                       + '(0[Xx])?[0-9][0-9_]*(\\.[0-9_]*)?(?:[pP](?:[+-]?[0-9_]+)?)?)\\b',
                relevance: 0
              },

              // Hex number in $
              {
                begin: '\\$[0-9][0-9A-Fa-f]*',
                relevance: 0
              },

              // Number in H,D,T,Q,O,B,Y suffix
              { begin: '\\b(?:[0-9A-Fa-f][0-9A-Fa-f_]*[Hh]|[0-9][0-9_]*[DdTt]?|[0-7][0-7_]*[QqOo]|[0-1][0-1_]*[BbYy])\\b' },

              // Number in X,D,T,Q,O,B,Y prefix
              { begin: '\\b(?:0[Xx][0-9A-Fa-f_]+|0[DdTt][0-9_]+|0[QqOo][0-7_]+|0[BbYy][0-1_]+)\\b' }
            ]
          },
          // Double quote string
          hljs.QUOTE_STRING_MODE,
          {
            className: 'string',
            variants: [
              // Single-quoted string
              {
                begin: '\'',
                end: '[^\\\\]\''
              },
              // Backquoted string
              {
                begin: '`',
                end: '[^\\\\]`'
              }
            ],
            relevance: 0
          },
          {
            className: 'symbol',
            variants: [
              // Global label and local label
              { begin: '^\\s*[A-Za-z._?][A-Za-z0-9_$#@~.?]*(:|\\s+label)' },
              // Macro-local label
              { begin: '^\\s*%%[A-Za-z0-9_$#@~.?]*:' }
            ],
            relevance: 0
          },
          // Macro parameter
          {
            className: 'subst',
            begin: '%[0-9]+',
            relevance: 0
          },
          // Macro parameter
          {
            className: 'subst',
            begin: '%!\S+',
            relevance: 0
          },
          {
            className: 'meta',
            begin: /^\s*\.[\w_-]+/
          }
        ]
      };
    }

    /*
    Language: XQuery
    Author: Dirk Kirsten <dk@basex.org>
    Contributor: Duncan Paterson
    Description: Supports XQuery 3.1 including XQuery Update 3, so also XPath (as it is a superset)
    Refactored to process xml constructor syntax and function-bodies. Added missing data-types, xpath operands, inbuilt functions, and query prologs
    Website: https://www.w3.org/XML/Query/
    Category: functional
    Audit: 2020
    */

    /** @type LanguageFn */
    function xquery(_hljs) {
      // see https://www.w3.org/TR/xquery/#id-terminal-delimitation
      const KEYWORDS = [
        "module",
        "schema",
        "namespace",
        "boundary-space",
        "preserve",
        "no-preserve",
        "strip",
        "default",
        "collation",
        "base-uri",
        "ordering",
        "context",
        "decimal-format",
        "decimal-separator",
        "copy-namespaces",
        "empty-sequence",
        "except",
        "exponent-separator",
        "external",
        "grouping-separator",
        "inherit",
        "no-inherit",
        "lax",
        "minus-sign",
        "per-mille",
        "percent",
        "schema-attribute",
        "schema-element",
        "strict",
        "unordered",
        "zero-digit",
        "declare",
        "import",
        "option",
        "function",
        "validate",
        "variable",
        "for",
        "at",
        "in",
        "let",
        "where",
        "order",
        "group",
        "by",
        "return",
        "if",
        "then",
        "else",
        "tumbling",
        "sliding",
        "window",
        "start",
        "when",
        "only",
        "end",
        "previous",
        "next",
        "stable",
        "ascending",
        "descending",
        "allowing",
        "empty",
        "greatest",
        "least",
        "some",
        "every",
        "satisfies",
        "switch",
        "case",
        "typeswitch",
        "try",
        "catch",
        "and",
        "or",
        "to",
        "union",
        "intersect",
        "instance",
        "of",
        "treat",
        "as",
        "castable",
        "cast",
        "map",
        "array",
        "delete",
        "insert",
        "into",
        "replace",
        "value",
        "rename",
        "copy",
        "modify",
        "update"
      ];

      // Node Types (sorted by inheritance)
      // atomic types (sorted by inheritance)
      const TYPES = [
        "item",
        "document-node",
        "node",
        "attribute",
        "document",
        "element",
        "comment",
        "namespace",
        "namespace-node",
        "processing-instruction",
        "text",
        "construction",
        "xs:anyAtomicType",
        "xs:untypedAtomic",
        "xs:duration",
        "xs:time",
        "xs:decimal",
        "xs:float",
        "xs:double",
        "xs:gYearMonth",
        "xs:gYear",
        "xs:gMonthDay",
        "xs:gMonth",
        "xs:gDay",
        "xs:boolean",
        "xs:base64Binary",
        "xs:hexBinary",
        "xs:anyURI",
        "xs:QName",
        "xs:NOTATION",
        "xs:dateTime",
        "xs:dateTimeStamp",
        "xs:date",
        "xs:string",
        "xs:normalizedString",
        "xs:token",
        "xs:language",
        "xs:NMTOKEN",
        "xs:Name",
        "xs:NCName",
        "xs:ID",
        "xs:IDREF",
        "xs:ENTITY",
        "xs:integer",
        "xs:nonPositiveInteger",
        "xs:negativeInteger",
        "xs:long",
        "xs:int",
        "xs:short",
        "xs:byte",
        "xs:nonNegativeInteger",
        "xs:unisignedLong",
        "xs:unsignedInt",
        "xs:unsignedShort",
        "xs:unsignedByte",
        "xs:positiveInteger",
        "xs:yearMonthDuration",
        "xs:dayTimeDuration"
      ];

      const LITERALS = [
        "eq",
        "ne",
        "lt",
        "le",
        "gt",
        "ge",
        "is",
        "self::",
        "child::",
        "descendant::",
        "descendant-or-self::",
        "attribute::",
        "following::",
        "following-sibling::",
        "parent::",
        "ancestor::",
        "ancestor-or-self::",
        "preceding::",
        "preceding-sibling::",
        "NaN"
      ];

      // functions (TODO: find regex for op: without breaking build)
      const BUILT_IN = {
        className: 'built_in',
        variants: [
          {
            begin: /\barray:/,
            end: /(?:append|filter|flatten|fold-(?:left|right)|for-each(?:-pair)?|get|head|insert-before|join|put|remove|reverse|size|sort|subarray|tail)\b/
          },
          {
            begin: /\bmap:/,
            end: /(?:contains|entry|find|for-each|get|keys|merge|put|remove|size)\b/
          },
          {
            begin: /\bmath:/,
            end: /(?:a(?:cos|sin|tan[2]?)|cos|exp(?:10)?|log(?:10)?|pi|pow|sin|sqrt|tan)\b/
          },
          {
            begin: /\bop:/,
            end: /\(/,
            excludeEnd: true
          },
          {
            begin: /\bfn:/,
            end: /\(/,
            excludeEnd: true
          },
          // do not highlight inbuilt strings as variable or xml element names
          { begin: /[^</$:'"-]\b(?:abs|accumulator-(?:after|before)|adjust-(?:date(?:Time)?|time)-to-timezone|analyze-string|apply|available-(?:environment-variables|system-properties)|avg|base-uri|boolean|ceiling|codepoints?-(?:equal|to-string)|collation-key|collection|compare|concat|contains(?:-token)?|copy-of|count|current(?:-)?(?:date(?:Time)?|time|group(?:ing-key)?|output-uri|merge-(?:group|key))?data|dateTime|days?-from-(?:date(?:Time)?|duration)|deep-equal|default-(?:collation|language)|distinct-values|document(?:-uri)?|doc(?:-available)?|element-(?:available|with-id)|empty|encode-for-uri|ends-with|environment-variable|error|escape-html-uri|exactly-one|exists|false|filter|floor|fold-(?:left|right)|for-each(?:-pair)?|format-(?:date(?:Time)?|time|integer|number)|function-(?:arity|available|lookup|name)|generate-id|has-children|head|hours-from-(?:dateTime|duration|time)|id(?:ref)?|implicit-timezone|in-scope-prefixes|index-of|innermost|insert-before|iri-to-uri|json-(?:doc|to-xml)|key|lang|last|load-xquery-module|local-name(?:-from-QName)?|(?:lower|upper)-case|matches|max|minutes-from-(?:dateTime|duration|time)|min|months?-from-(?:date(?:Time)?|duration)|name(?:space-uri-?(?:for-prefix|from-QName)?)?|nilled|node-name|normalize-(?:space|unicode)|not|number|one-or-more|outermost|parse-(?:ietf-date|json)|path|position|(?:prefix-from-)?QName|random-number-generator|regex-group|remove|replace|resolve-(?:QName|uri)|reverse|root|round(?:-half-to-even)?|seconds-from-(?:dateTime|duration|time)|snapshot|sort|starts-with|static-base-uri|stream-available|string-?(?:join|length|to-codepoints)?|subsequence|substring-?(?:after|before)?|sum|system-property|tail|timezone-from-(?:date(?:Time)?|time)|tokenize|trace|trans(?:form|late)|true|type-available|unordered|unparsed-(?:entity|text)?-?(?:public-id|uri|available|lines)?|uri-collection|xml-to-json|years?-from-(?:date(?:Time)?|duration)|zero-or-one)\b/ },
          {
            begin: /\blocal:/,
            end: /\(/,
            excludeEnd: true
          },
          {
            begin: /\bzip:/,
            end: /(?:zip-file|(?:xml|html|text|binary)-entry| (?:update-)?entries)\b/
          },
          {
            begin: /\b(?:util|db|functx|app|xdmp|xmldb):/,
            end: /\(/,
            excludeEnd: true
          }
        ]
      };

      const TITLE = {
        className: 'title',
        begin: /\bxquery version "[13]\.[01]"\s?(?:encoding ".+")?/,
        end: /;/
      };

      const VAR = {
        className: 'variable',
        begin: /[$][\w\-:]+/
      };

      const NUMBER = {
        className: 'number',
        begin: /(\b0[0-7_]+)|(\b0x[0-9a-fA-F_]+)|(\b[1-9][0-9_]*(\.[0-9_]+)?)|[0_]\b/,
        relevance: 0
      };

      const STRING = {
        className: 'string',
        variants: [
          {
            begin: /"/,
            end: /"/,
            contains: [
              {
                begin: /""/,
                relevance: 0
              }
            ]
          },
          {
            begin: /'/,
            end: /'/,
            contains: [
              {
                begin: /''/,
                relevance: 0
              }
            ]
          }
        ]
      };

      const ANNOTATION = {
        className: 'meta',
        begin: /%[\w\-:]+/
      };

      const COMMENT = {
        className: 'comment',
        begin: /\(:/,
        end: /:\)/,
        relevance: 10,
        contains: [
          {
            className: 'doctag',
            begin: /@\w+/
          }
        ]
      };

      // see https://www.w3.org/TR/xquery/#id-computedConstructors
      // mocha: computed_inbuilt
      // see https://www.regexpal.com/?fam=99749
      const COMPUTED = {
        beginKeywords: 'element attribute comment document processing-instruction',
        end: /\{/,
        excludeEnd: true
      };

      // mocha: direct_method
      const DIRECT = {
        begin: /<([\w._:-]+)(\s+\S*=('|").*('|"))?>/,
        end: /(\/[\w._:-]+>)/,
        subLanguage: 'xml',
        contains: [
          {
            begin: /\{/,
            end: /\}/,
            subLanguage: 'xquery'
          },
          'self'
        ]
      };

      const CONTAINS = [
        VAR,
        BUILT_IN,
        STRING,
        NUMBER,
        COMMENT,
        ANNOTATION,
        TITLE,
        COMPUTED,
        DIRECT
      ];

      return {
        name: 'XQuery',
        aliases: [
          'xpath',
          'xq'
        ],
        case_insensitive: false,
        illegal: /(proc)|(abstract)|(extends)|(until)|(#)/,
        keywords: {
          $pattern: /[a-zA-Z$][a-zA-Z0-9_:-]*/,
          keyword: KEYWORDS,
          type: TYPES,
          literal: LITERALS
        },
        contains: CONTAINS
      };
    }

    /*
    Language: YAML
    Description: Yet Another Markdown Language
    Author: Stefan Wienert <stwienert@gmail.com>
    Contributors: Carl Baxter <carl@cbax.tech>
    Requires: ruby.js
    Website: https://yaml.org
    Category: common, config
    */
    function yaml(hljs) {
      const LITERALS = 'true false yes no null';

      // YAML spec allows non-reserved URI characters in tags.
      const URI_CHARACTERS = '[\\w#;/?:@&=+$,.~*\'()[\\]]+';

      // Define keys as starting with a word character
      // ...containing word chars, spaces, colons, forward-slashes, hyphens and periods
      // ...and ending with a colon followed immediately by a space, tab or newline.
      // The YAML spec allows for much more than this, but this covers most use-cases.
      const KEY = {
        className: 'attr',
        variants: [
          { begin: '\\w[\\w :\\/.-]*:(?=[ \t]|$)' },
          { // double quoted keys
            begin: '"\\w[\\w :\\/.-]*":(?=[ \t]|$)' },
          { // single quoted keys
            begin: '\'\\w[\\w :\\/.-]*\':(?=[ \t]|$)' }
        ]
      };

      const TEMPLATE_VARIABLES = {
        className: 'template-variable',
        variants: [
          { // jinja templates Ansible
            begin: /\{\{/,
            end: /\}\}/
          },
          { // Ruby i18n
            begin: /%\{/,
            end: /\}/
          }
        ]
      };
      const STRING = {
        className: 'string',
        relevance: 0,
        variants: [
          {
            begin: /'/,
            end: /'/
          },
          {
            begin: /"/,
            end: /"/
          },
          { begin: /\S+/ }
        ],
        contains: [
          hljs.BACKSLASH_ESCAPE,
          TEMPLATE_VARIABLES
        ]
      };

      // Strings inside of value containers (objects) can't contain braces,
      // brackets, or commas
      const CONTAINER_STRING = hljs.inherit(STRING, { variants: [
        {
          begin: /'/,
          end: /'/
        },
        {
          begin: /"/,
          end: /"/
        },
        { begin: /[^\s,{}[\]]+/ }
      ] });

      const DATE_RE = '[0-9]{4}(-[0-9][0-9]){0,2}';
      const TIME_RE = '([Tt \\t][0-9][0-9]?(:[0-9][0-9]){2})?';
      const FRACTION_RE = '(\\.[0-9]*)?';
      const ZONE_RE = '([ \\t])*(Z|[-+][0-9][0-9]?(:[0-9][0-9])?)?';
      const TIMESTAMP = {
        className: 'number',
        begin: '\\b' + DATE_RE + TIME_RE + FRACTION_RE + ZONE_RE + '\\b'
      };

      const VALUE_CONTAINER = {
        end: ',',
        endsWithParent: true,
        excludeEnd: true,
        keywords: LITERALS,
        relevance: 0
      };
      const OBJECT = {
        begin: /\{/,
        end: /\}/,
        contains: [ VALUE_CONTAINER ],
        illegal: '\\n',
        relevance: 0
      };
      const ARRAY = {
        begin: '\\[',
        end: '\\]',
        contains: [ VALUE_CONTAINER ],
        illegal: '\\n',
        relevance: 0
      };

      const MODES = [
        KEY,
        {
          className: 'meta',
          begin: '^---\\s*$',
          relevance: 10
        },
        { // multi line string
          // Blocks start with a | or > followed by a newline
          //
          // Indentation of subsequent lines must be the same to
          // be considered part of the block
          className: 'string',
          begin: '[\\|>]([1-9]?[+-])?[ ]*\\n( +)[^ ][^\\n]*\\n(\\2[^\\n]+\\n?)*'
        },
        { // Ruby/Rails erb
          begin: '<%[%=-]?',
          end: '[%-]?%>',
          subLanguage: 'ruby',
          excludeBegin: true,
          excludeEnd: true,
          relevance: 0
        },
        { // named tags
          className: 'type',
          begin: '!\\w+!' + URI_CHARACTERS
        },
        // https://yaml.org/spec/1.2/spec.html#id2784064
        { // verbatim tags
          className: 'type',
          begin: '!<' + URI_CHARACTERS + ">"
        },
        { // primary tags
          className: 'type',
          begin: '!' + URI_CHARACTERS
        },
        { // secondary tags
          className: 'type',
          begin: '!!' + URI_CHARACTERS
        },
        { // fragment id &ref
          className: 'meta',
          begin: '&' + hljs.UNDERSCORE_IDENT_RE + '$'
        },
        { // fragment reference *ref
          className: 'meta',
          begin: '\\*' + hljs.UNDERSCORE_IDENT_RE + '$'
        },
        { // array listing
          className: 'bullet',
          // TODO: remove |$ hack when we have proper look-ahead support
          begin: '-(?=[ ]|$)',
          relevance: 0
        },
        hljs.HASH_COMMENT_MODE,
        {
          beginKeywords: LITERALS,
          keywords: { literal: LITERALS }
        },
        TIMESTAMP,
        // numbers are any valid C-style number that
        // sit isolated from other words
        {
          className: 'number',
          begin: hljs.C_NUMBER_RE + '\\b',
          relevance: 0
        },
        OBJECT,
        ARRAY,
        STRING
      ];

      const VALUE_MODES = [ ...MODES ];
      VALUE_MODES.pop();
      VALUE_MODES.push(CONTAINER_STRING);
      VALUE_CONTAINER.contains = VALUE_MODES;

      return {
        name: 'YAML',
        case_insensitive: true,
        aliases: [ 'yml' ],
        contains: MODES
      };
    }

    var builtIns = /*#__PURE__*/Object.freeze({
        __proto__: null,
        grmr_abnf: abnf,
        grmr_accesslog: accesslog,
        grmr_ada: ada,
        grmr_armasm: armasm,
        grmr_avrasm: avrasm,
        grmr_awk: awk,
        grmr_bash: bash,
        grmr_bnf: bnf,
        grmr_c: c,
        grmr_ceylon: ceylon,
        grmr_clean: clean,
        grmr_clojure: clojure,
        grmr_cmake: cmake,
        grmr_cpp: cpp,
        grmr_crystal: crystal,
        grmr_csharp: csharp,
        grmr_csp: csp,
        grmr_css: css,
        grmr_d: d,
        grmr_xml: xml,
        grmr_markdown: markdown,
        grmr_dart: dart,
        grmr_diff: diff,
        grmr_dust: dust,
        grmr_ebnf: ebnf,
        grmr_elixir: elixir,
        grmr_elm: elm,
        grmr_erlang: erlang,
        grmr_fortran: fortran,
        grmr_fsharp: fsharp,
        grmr_glsl: glsl,
        grmr_go: go,
        grmr_gradle: gradle,
        grmr_graphql: graphql,
        grmr_groovy: groovy,
        grmr_haskell: haskell,
        grmr_haxe: haxe,
        grmr_java: java,
        grmr_javascript: javascript,
        grmr_json: json,
        grmr_julia: julia,
        grmr_kotlin: kotlin,
        grmr_lisp: lisp,
        grmr_llvm: llvm,
        grmr_lua: lua,
        grmr_makefile: makefile,
        grmr_mathematica: mathematica,
        grmr_matlab: matlab,
        grmr_mipsasm: mipsasm,
        grmr_nim: nim,
        grmr_nix: nix,
        grmr_objectivec: objectivec,
        grmr_ocaml: ocaml,
        grmr_perl: perl,
        grmr_php: php,
        grmr_pony: pony,
        grmr_powershell: powershell,
        grmr_protobuf: protobuf,
        grmr_python: python,
        grmr_ruby: ruby,
        grmr_rust: rust,
        grmr_scala: scala,
        grmr_scheme: scheme,
        grmr_scss: scss,
        grmr_shell: shell,
        grmr_smalltalk: smalltalk,
        grmr_swift: swift,
        grmr_tcl: tcl,
        grmr_thrift: thrift,
        grmr_typescript: typescript,
        grmr_vala: vala,
        grmr_vim: vim,
        grmr_wasm: wasm,
        grmr_wren: wren,
        grmr_x86asm: x86asm,
        grmr_xquery: xquery,
        grmr_yaml: yaml
    });

    const hljs = HighlightJS;

    for (const key of Object.keys(builtIns)) {
      // our builtInLanguages Rollup plugin has to use `_` to allow identifiers to be
      // compatible with `export` naming conventions, so we need to convert the
      // identifiers back into the more typical dash style that we use for language
      // naming via the API
      const languageName = key.replace("grmr_", "").replace("_", "-");
      hljs.registerLanguage(languageName, builtIns[key]);
    }

    return hljs;

})();
if (typeof exports === 'object' && typeof module !== 'undefined') { module.exports = hljs; }
