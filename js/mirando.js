/* Use https://www.danstools.com/javascript-minify/ to shrink javascript. */

//var hostForMirandoJs = "get.mirando.devx:9010";
var hostForMirandoJs = "get.mirando.de";

var mirandoJsDebug = false;

if (window.location.href.indexOf('mirandodebug=1') >= 0)
    mirandoJsDebug = true;

if (typeof Mirando == "undefined") {
    var Mirando = {};
}

if (typeof Mirando.instanceRegistry == "undefined") {

    (function () {
        function InstanceRegistry() {

            var me = this;
            var instances = {};

            this.getNextInstanceIdFor = function (adPlaceId) {

                if (!instances[adPlaceId]) {
                    instances[adPlaceId] = 1;
                }
                else {
                    instances[adPlaceId]++;
                }

                return instances[adPlaceId];
            };

        }

        Mirando.instanceRegistry = new InstanceRegistry();
    })();
}

if (typeof Mirando.log == "undefined") {

    (function () {
        var MirLog = function () {

            var entries = [];

            this.out = function (msg) {
                entries.push(msg);
            };

            this.dump = function () {
                if (typeof console == "undefined" || typeof console.info == "undefined") {
                    alert(entries.join('\n'));
                }
                else {
                    for (var i = 0; i < entries.length; i++) {
                        console.info(entries[i]);
                    }
                }
                entries = [];
            };
        };
        Mirando.log = new MirLog();
    }());
}

Mirando.SideAd = {
    variables: {
        rightSearched: false,
        leftSearched: false
    },

    settings: {
        adMargin: 10
    },

    tryPlace: function (minW, minH, ad) {
        var self = this,
            intervall = null,
            leftAlign = false;

        if (!self.variables.rightSearched) {
            intervals = self.calcIntervals(self.calcNotIntervals(minW, false));
            interval = self.findSuitableInterval(intervals, minH);
            self.variables.rightSearched = true;
        }

        if (interval === null && !self.variables.leftSearched) {
            intervals = self.calcIntervals(self.calcNotIntervals(minW, true));
            interval = self.findSuitableInterval(intervals, minH);
            self.variables.leftSearched = true;
            leftAlign = true;
        }

        if (null !== interval) {
            var adjElems = self.findAdjacentElements(interval);
            self.placeAd(ad, interval, adjElems, minW, minH, leftAlign);
        }

        return null !== interval;
    },
    calcNotIntervals: function (minW, leftAlign) {
        var self = this,
            elements = self.findElementsForPlacing(document.body),
            maxW = window.innerWidth;
        var intervals = [];

        for (var i = 0; i < elements.length; i++) {
            var element = elements[i],
                rect = self.getScreenRect(element),
                top = rect.top,
                bottom = rect.bottom;


            //console.log('right:' + rect.right);

            var enoughSpaceLeft = false;
            if (!leftAlign && maxW - rect.right > minW) {
                enoughSpaceLeft = true;
            } else if (leftAlign && rect.left > minW + self.settings.adMargin) {
                enoughSpaceLeft = true;
            }

            var area = (rect.right - rect.left) * (rect.bottom - rect.top);

            if (enoughSpaceLeft || area === 0) {
                continue;
            }

            //console.log('left:' + rect.left + 'interval:' + top + '~' + bottom);
            //console.log(getComputedStyle(element).getPropertyValue('position'));

            //console.log('area:' + area);
            //console.log('position:' + getComputedStyle(element).getPropertyValue('position'));

            /*if (element.outerHTML.length > 200) {
                console.log(element.outerHTML.substr(0, 200));
            } else {
                console.log(element.outerHTML);
            }*/

            if (!(top in intervals) || intervals[top] < bottom) {
                intervals[top] = bottom;
                //console.log('not interval:' + top + '~' + bottom);
            }
        }

        return self.sortIntervals(intervals);
    },

    findElementsForPlacing: function (parentElem) {
        var self = this,
            elements = parentElem.children,
            foundElems = [];

        for (var i = 0; i < elements.length; i++) {
            var element = elements[i],
                rect = self.getScreenRect(element);

            if ('fixed' == getComputedStyle(element).getPropertyValue('position')) {
                //alert('layer for skip found');
                continue;
            }

            if ((rect.top === 0 && rect.bottom === 0 ) || self.isWorthlessLayer(element, rect)) {
                continue;
            }
            if (self.isWrappingDiv(element, parentElem)) {
                var childElems = self.findElementsForPlacing(element);
                foundElems = foundElems.concat(childElems);
            } else {
                foundElems.push(element);
            }
        }

        return foundElems;
    },

    isWrappingDiv: function (elem, parentElem) {
        var self = this;

        if (parentElem.tagName.toLowerCase() !== 'body' || getComputedStyle(elem).getPropertyValue('position') === 'fixed') {
            return false;
        }
        if (elem.align === 'center' || self.textNodesUnder(elem).length === 0) {
            return true;
        }
    },

    textNodesUnder: function (el) {
        return [].filter.call(el.childNodes, function (k) {
            return k.nodeType == Node.TEXT_NODE && k.nodeValue.trim() !== '';
        });
    },


    sortIntervals: function (intervals) {
        function sortN(a, b) {
            return a - b;
        }

        var sIntervals = [];

        var keys = Object.keys(intervals).sort(sortN);
        for (var i = 0; i < keys.length; i++) {
            sIntervals[keys[i]] = intervals[keys[i]];
        }

        return sIntervals;
    },
    calcIntervals: function (notIntervals) {
        var intervals = [],
            intervalStart = 0;


        if (Object.keys(notIntervals).length === 0) {
            var docHeight = document.body.scrollHeight;

            return [[0, docHeight]];
        }

        for (var notIStart in notIntervals) {
            if (notIStart > intervalStart) {
                intervals.push([intervalStart, notIStart - 1]);

                //console.log(intervalStart + ' ~ ' + (notIStart - 1));
            }
            intervalStart = notIntervals[notIStart] + 1;
        }

        return intervals;
    },
    findSuitableInterval: function (intervals, minH) {
        var self = this;

        for (var i = 0; i < intervals.length; i++) {
            var interval = intervals[i];
            if (interval[1] - interval[0] > minH) {
                //console.log('interval found:' + interval[0] + ':' + interval[1]);
                return interval;
            }
        }

        return null;
    },
    findAdjacentElements: function (interval) {
        var self = this,
            elements = self.findElementsForPlacing(document.body),
            adjElems = [];

        for (var i = 0; i < elements.length; i++) {
            var element = elements[i],
                rect = self.getScreenRect(element);

            if ((rect.top >= interval[0] && rect.top <= interval[1])
                || (rect.bottom >= interval[0] && rect.bottom <= interval[1])
                || (rect.top <= interval[0] && rect.bottom >= interval[1])
            ) {
                adjElems.push(element);
                //console.log('adjacent element found' + rect.right);
            }
        }

        return adjElems;
    },
    isWorthlessLayer: function (elem, rect) {
        var position = getComputedStyle(elem).getPropertyValue('position'),
            area = (rect.right - rect.left) * (rect.bottom - rect.top);

        return ('fixed' === position || 'absolute' === position) && area < 20000;
    },
    getScreenRect: function (elem) {
        var rect = elem.getBoundingClientRect(),
            screenRect = [];

        screenRect.right = Math.round(rect.right + window.scrollX);
        screenRect.left = Math.round(rect.left + window.scrollX);
        screenRect.top = Math.round(rect.top + window.scrollY);
        screenRect.bottom = Math.round(rect.bottom + window.scrollY);

        return screenRect;
    },
    placeAd: function (ad, interval, adjElems, minW, minH, leftAlign) {
        var self = this,
            div = document.createElement('div');

        div.style.maxWidth = minW + 'px';
        div.style.maxHeight = minH + 'px';
        //div.style.pointerEvents = 'none';
        div.style.background = 'transparent';
        div.style.position = 'absolute';
        div.style.zIndex = '0';

        var placeAdFunc = function () {
            var borderValue = leftAlign ? 99999 : 0;
            for (var i = 0; i < adjElems.length; i++) {
                var rect = self.getScreenRect(adjElems[i]);

                if (leftAlign) {
                    borderValue = rect.left < borderValue ? rect.left : borderValue;
                } else {
                    borderValue = rect.right > borderValue ? rect.right : borderValue;
                }
            }

            if (leftAlign) {
                div.style.left = (borderValue - self.settings.adMargin - minW) + 'px';
            } else {
                div.style.left = (borderValue + self.settings.adMargin) + 'px';
            }

            if (window.scrollY - self.settings.adMargin > interval[1] - minH) {
                div.style.position = 'absolute';
                div.style.top = (interval[1] - minH) + 'px';
            } else if (window.scrollY - self.settings.adMargin > interval[0]) {
                div.style.position = 'fixed';
                div.style.top = self.settings.adMargin + 'px';
            } else {
                div.style.position = 'absolute';
                div.style.top = (interval[0] < self.settings.adMargin ? self.settings.adMargin : interval[0]) + 'px';
            }
        };

        window.addEventListener('scroll', placeAdFunc);
        window.addEventListener('resize', placeAdFunc);

        document.body.append(div);

        if (typeof mirandoAsyncLoader !== 'undefined') {
            mirandoAsyncLoader.insertInsideHtml(div, ad);
        } else {
            div.innerHTML = ad;
        }

        placeAdFunc();
    }
};


Mirando.ImpressionIdFactory = function () {

    var uuIdFactory = new Mirando.UuIdFactory();

    /**
     * generates or creates an impressionId
     */
    this.getOrCreate = function () {

        var result = load();
        if (!result) {
            result = createNew();
            if (!save(result))
                return null;
        }

        return result;
    };

    function createNew() {
        return uuIdFactory.create();
    }

    function load() {
        try {
            var id = getParentWindow().mirImpId;
            if (id) {
                return uuIdFactory.parse(id);
            }
        }
        catch (e) {
            return false;
        }
        return false;
    }

    function save(impId) {
        try {
            getParentWindow().mirImpId = impId.toString();
        }
        catch (e) {
            return false;
        }
        return true;
    }

    function getParentWindow() {

        var win, depth, maxDepth = 10;

        do {
            win = window.parent;
            depth++;
        }
        while (win.parent != win && depth < maxDepth);


        return win;
    }

    var that = this;
};

Mirando.UuIdFactory = function () {

    var uuidPattern = new RegExp(/^[a-z0-9]{8}\-[a-z0-9]{4}\-[a-z0-9]{4}\-[a-z0-9]{4}\-[a-z0-9]{12}$/);

    var hexDigits = '0123456789abcdef';
    var pattern = "########-####-####-####-############";


    /**
     * Represents a simplified UUID (which does by far not meet the
     * requirements according to rfc4122)
     */
    var UuId = function (uuid) {
        this.toString = function () {
            return uuid;
        }
    };

    this.create = function () {

        var result = [];
        for (var i = 0; i < pattern.length; i++) {

            var c = pattern.charAt(i);

            if (c == '#') {
                result.push(randomDigit());
            }
            else {
                result.push(c);
            }
        }
        return new UuId(result.join(''));
    };

    this.parse = function (uuidAsString) {

        if (uuidPattern.exec(uuidAsString) == null) {
            throw 'Invalid UuId: ' + uuidAsString;
        }

        return new UuId(uuidAsString);
    };

    function randomDigit() {
        return hexDigits.charAt([Math.floor(Math.random() * 16)]);
    }
};

Mirando.QueryStringParser = function () {

    var queryStringPattern = new RegExp(/(\?|#)(.*)/);

    var params = null;
    var queryString;

    var mirandoScript = null;

    this.get = function (name) {
        return params[name];
    };

    this.getAllParams = function (notParams) {
        notParams = notParams ? notParams : [];

        var filteredParams = [];
        for (var index in params) {

            var param = params[index];

            if (notParams.indexOf(index) < 0 && typeof param === 'string') {
                filteredParams[index] = param;
            }
        }

        return filteredParams;
    };

    this.init = function (scriptIndex) {
        var self = this;
        mirandoScript = getMirandoScriptInsertAtX(scriptIndex);
        if (mirandoScript === null)
            return false;
        params = self.parse(scriptIndex);
        return true;
    };

    this.getScript = function () {
        return mirandoScript;
    };

    this.toString = function () {
        var result = [];
        for (var i in params) {
            if (typeof params[i] != 'function' && typeof params[i] != 'object') {
                result.push(i + "=" + params[i]);
            }
        }
        return result.join('&');
    };

    this.getMirandoScriptInsertAtX = function (index) {
        return getMirandoScriptInsertAtX(index);
    };

    this.getLastMirandoScriptInserted = function () {
        return getLastMirandoScriptInsert();
    };

    this.parse = function () {
        var self = this;

        return self.parseUrl(mirandoScript.src.replaceAll('&amp;', '&').replaceAll('&#038;', '&') );
    };

    this.parseUrl = function (url) {
        return parseUrl(url);
    };

    function parseUrl(url) {
        var result = [];

        var groups = queryStringPattern.exec(url);

        if (!groups) {
            return result;
        }

        if (groups.length == 3) {

            var queryString = groups[2];
            var pairs = queryString.split(/[;&]/);

            for (var i = 0; i < pairs.length; i++) {

                var keyVal = pairs[i].split('=');

                if (keyVal && keyVal.length == 2 && typeof keyVal[1] === 'string') {
                    var key = unescape(keyVal[0]);
                    result[key] = unescape(keyVal[1]);
                }
            }
        }
        return result;
    }

    function getLastMirandoScriptInsert() {

        var scripts = document.getElementsByTagName('script');
        var myScript = null;

        for (var i = scripts.length; i > 0; i--) {
            if (scripts[i - 1].src.indexOf('mirando.js') >= 0) {
                myScript = scripts[i - 1];
                break;
            }
        }
        return myScript;
    }

    function getMirandoScriptInsertAtX(index) {
        var scripts = document.getElementsByTagName('script');
        var myScript = null;

        var indexCounter = 0;
        for (var i = 0; i < scripts.length; i++) {
            if (scripts[i].src.indexOf('mirando.js') >= 0) {
                if (indexCounter == index) {
                    myScript = scripts[i];
                    return myScript
                }
                indexCounter++;
            }
        }
        console.log('!!!no script found at ' + index);
        return null;
    }
};

Mirando.Color = {
    /**
     * @param {string} color
     * @returns {object|null}
     */
    parse: function (color) {
        if (!color) {
            return null;
        }

        color = color.trim().toLowerCase();
        var hex3 = color.match(/^#([0-9a-f]{3})$/i);
        if (hex3) {
            hex3 = hex3[1];
            return {
                r: parseInt(hex3.charAt(0), 16) * 0x11,
                g: parseInt(hex3.charAt(1), 16) * 0x11,
                b: parseInt(hex3.charAt(2), 16) * 0x11,
                a: 1
            };
        }
        var hex6 = color.match(/^#([0-9a-f]{6})$/i);
        if (hex6) {
            hex6 = hex6[1];
            return {
                r: parseInt(hex6.substr(0, 2), 16),
                g: parseInt(hex6.substr(2, 2), 16),
                b: parseInt(hex6.substr(4, 2), 16),
                a: 1
            };
        }
        var rgba = color.match(/^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+.*\d*)\s*\)$/i) || color.match(/^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
        if (rgba) {
            return {
                r: parseInt(rgba[1]),
                g: parseInt(rgba[2]),
                b: parseInt(rgba[3]),
                a: rgba[4] === undefined ? 1 : parseInt(rgba[4])
            };
        }
        var rgb = color.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
        if (rgb) {
            return {
                r: parseInt(rgb[1]),
                g: parseInt(rgb[2]),
                b: parseInt(rgb[3]),
                a: 1
            };
        }

        return null;
    },

    /**
     * @param {object} colorValueOne
     * @param {object} colorValueTwo
     * @returns {boolean}
     */
    equals: function (colorValueOne, colorValueTwo) {
        return colorValueOne.r === colorValueTwo.r
            && colorValueOne.g === colorValueTwo.g
            && colorValueOne.b === colorValueTwo.b
            && colorValueOne.a === colorValueTwo.a;
    },

    /**
     * @param color
     * @returns {boolean}
     */
    isGreyOrBlackOrWhite: function(color) {
        if (!color) {
            return false;
        }

        var colorValue = this.parse(color);

        return colorValue.r === colorValue.g && colorValue.b === colorValue.g && colorValue.b === colorValue.r;
    },

    /**
     * @param color
     * @returns {boolean}
     */
    isTransparent: function(color) {
        var colorValue = this.parse(color);
        if (null === colorValue) {
            return false;
        }

        return colorValue.a === 0;
    },

    /**
     * @param color
     * @returns {string}
     */
    makeNotTransparent: function(color) {
        var colorValue = this.parse(color);
        colorValue.a = 1;

        return this.toColorString(colorValue);
    },

    /**
     * @param colorObject
     * @returns {string}
     */
    toColorString: function(colorObject) {
        return "rgba(" + colorObject.r + ", " + colorObject.g + ", " + colorObject.b + ", " + colorObject.a + ")"
    },

    /**
     * @param {array} colors
     * @param {boolean} ignoreBlackWhite
     * @param {array} ignoreColors
     * @returns {object|null}
     */
    findExtraOrdinaryColor: function (colors, ignoreBlackWhite, ignoreColors) {
        ignoreBlackWhite = typeof ignoreBlackWhite === 'undefined' ? false : ignoreBlackWhite;
        ignoreColors = typeof ignoreColors === 'undefined' ? [] : ignoreColors;
        var ignoreColorvalues = ignoreColors.map(function (color) {
            return this.parse(color);

        });
        for (var i = 0; i < colors.length; i++) {
            var colorValue = Mirando.Color.parse(colors[i]);
            if (null === colorValue) {
                continue;
            }

            if (ignoreColorvalues.filter(function (c) {
                return this.equals(c, colorValue)
            }).length) {
                continue;
            }

            if (ignoreBlackWhite && this.isGreyOrBlackOrWhite(colors[i])) {
                continue;
            }

            if (colorValue.a === 0) {
                continue;
            }

            var colorSum = colorValue.r + colorValue.g + colorValue.b;

            if (colorSum === 0 || (colorSum === 255 * 3 && colorValue.a === 1)) {
                continue;
            }

            return this.toColorString(colorValue);
        }

        return null;
    },

    /**
     * @param {string} color
     * @returns {number}
     */
    luminance: function (color) {
        var colorValue = this.parse(color);
        var a = [colorValue.r, colorValue.g, colorValue.b].map(function (v) {
            v /= 255;
            return v <= 0.03928
                ? v / 12.92
                : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    },

    /**
     * minimal recommended contrast ratio is 4.5, or 3 for larger font-sizes
     * @param {string} colorOne
     * @param {string} colorTwo
     * @returns {number}
     */
    contrast: function (colorOne, colorTwo) {
        var l1 = this.luminance(colorOne) + 0.05,
            l2 = this.luminance(colorTwo) + 0.05;

        if (l1 > l2) {
            return l1 / l2;
        }

        return l2 / l1;
    }
};

Mirando.nativeAnalyzer = {
    start: function () {
        this._finished = false;
        this._finishCalbacks = [];
        this._analyzes = [];
        var that = this;

        var analyzeCall = function () {
            try {
                that._analyze(document, 'default');
            }
            catch(error) {
                console.log(error);
            }
        };

        if (document.readyState !== "loading") {
            analyzeCall();
        } else {
            document.addEventListener("DOMContentLoaded", function (event) {
                analyzeCall();
            });
        }
    },

    /**
     * @param {function} callbackFunction
     */
    registerCallbackIfFinished: function (callbackFunction) {
        if (this._finished) {
            callbackFunction();

            return;
        }

        this._finishCalbacks.push(callbackFunction);
    },

    /**
     * @param {String} analyzeName
     * @returns {Object}
     */
    findNativeSet: function (analyzeName) {
        if (typeof analyzeName === "undefined") {
            analyzeName = "default";
        }
        var analyze = this._analyzes[analyzeName];

        if (!analyze) {
            return;
        }

        var set = this._findColorSet(analyze);
        var props = [
            ["font", "monospace"],
            ["fontSize", "12px"],
            ["borderWidth", "1px"],
            ["headlineFont", "monospace"],
            ["headlineFontSize", "14px"],
            ["headlineFontWeight", "normal"],
            ["headlineFontTextDecoration", "none"],
            ["linkFont", "monospace"],
            ["linkFontTextDecoration", "none"],
            ["linkFontWeight", "normal"],
            ["linkFontSize", "12px"]
        ];
        props.forEach(function (prop) {

            var value = analyze[prop[0] + "s"];

            if (!value.length) {
                value = props[1];
            } else {
                value = value[0][0];
            }

            set[prop[0]] = value;
        });

        set.extraOrdinaryColor = this._findTypicalExtraOrdinaryColor(analyze);

        return set;
    },

    /**
     * @param {String} analyze
     * @returns {Object}
     * @private
     */
    _findColorSet: function (analyze) {
        var minWeight = 5;
        var extraOptimalSet = {};
        extraOptimalSet.backgroundColor = this._findExtraOrdinaryColorInTuples(analyze["backgroundColors"], minWeight, true);
        if (null === extraOptimalSet.backgroundColor) {
            extraOptimalSet.backgroundColor = this._findExtraOrdinaryColorInTuples(analyze["backgroundColors"], minWeight, false);
        }
        if (null === extraOptimalSet.backgroundColor) {
            extraOptimalSet.backgroundColor = "rgb(255,255,255)";
        }

        extraOptimalSet.fontColor = analyze["fontColors"].length > 0 ? analyze["fontColors"][0][0] : "rgb(0,0,0)";
        extraOptimalSet.linkFontColor = this._findExtraOrdinaryColorInTuples(analyze["linkFontColors"], minWeight, true);
        if (null === extraOptimalSet.linkFontColor) {
            extraOptimalSet.linkFontColor = this._findExtraOrdinaryColorInTuples(analyze["linkFontColors"], minWeight, false);
        }
        extraOptimalSet.headlineFontColor = this._findExtraOrdinaryColorInTuples(analyze["headlineFontColors"], minWeight, true);
        if (null === extraOptimalSet.headlineFontColor) {
            extraOptimalSet.headlineFontColor = this._findExtraOrdinaryColorInTuples(analyze["headlineFontColors"], minWeight, false);
        }
        extraOptimalSet.headlineFontColor = extraOptimalSet.headlineFontColor === null ? "rgb(0,0,0)" : extraOptimalSet.headlineFontColor;
        extraOptimalSet.borderColor = this._findExtraOrdinaryColorInTuples(analyze["borderColors"], minWeight, true);
        if (null === extraOptimalSet.borderColor) {
            extraOptimalSet.borderColor = this._findExtraOrdinaryColorInTuples(analyze["borderColors"], minWeight, false);
        }

        var optimalSet = {};
        optimalSet.backgroundColor = this._findExtraOrdinaryColorInTuples(analyze["backgroundColors"], minWeight, false);
        optimalSet.fontColor = analyze["fontColors"].length > 0 ? analyze["fontColors"][0][0] : "rgb(0,0,0)";
        optimalSet.linkFontColor = this._findExtraOrdinaryColorInTuples(analyze["linkFontColors"], minWeight, false);
        optimalSet.headlineFontColor = this._findExtraOrdinaryColorInTuples(analyze["headlineFontColors"], minWeight, false);
        optimalSet.borderColor = this._findExtraOrdinaryColorInTuples(analyze["borderColors"], minWeight, false);

        var goodSet = {};
        goodSet.backgroundColor = analyze["backgroundColors"].length > 0 ? analyze["backgroundColors"][0][0] : "rgb(255,255,255)";
        if (Mirando.Color.isTransparent(goodSet.backgroundColor)) {
            goodSet.backgroundColor = "rgb(255,255,255)";
        }
        goodSet.fontColor = analyze["fontColors"].length > 0 ? analyze["fontColors"][0][0] : "rgb(0,0,0)";
        goodSet.linkFontColor = analyze["linkFontColors"].length > 0 ? analyze["linkFontColors"][0][0] : "rgb(0,0,0)";
        goodSet.headlineFontColor = analyze["headlineFontColors"].length > 0 ? analyze["headlineFontColors"][0][0] : "rgb(0,0,0)";
        goodSet.borderColor = analyze["borderColors"].length > 0 ? analyze["borderColors"][0][0] : "rgb(0,0,0)";

        var fallbackSet = {};
        fallbackSet.backgroundColor = "rgb(255,255,255)";
        fallbackSet.fontColor = "rgb(0,0,0)";
        fallbackSet.linkFontColor = "rgb(0,0,0)";
        fallbackSet.headlineFontColor = "rgb(0,0,0)";
        fallbackSet.borderColor = "rgb(0,0,0)";

        var sets = [extraOptimalSet, optimalSet, goodSet, fallbackSet];

        for (var i = 0;  i < sets.length; i++) {
            var set = sets[i];
            set.backgroundColor = null === set.backgroundColor ? "rgb(255,255,255)" : set.backgroundColor;
            if (Mirando.Color.isTransparent(set.backgroundColor)) {
                set.backgroundColor = Mirando.Color.makeNotTransparent(set.backgroundColor);
            }

            if (Mirando.Color.isGreyOrBlackOrWhite(set.headlineFontColor) && !Mirando.Color.isGreyOrBlackOrWhite(set.linkFontColor)) {
                //change to more extraordinary link font color
                set.headlineFontColor = set.linkFontColor;
            }

            set.fontColor = null === set.fontColor ? "rgb(0,0,0)" : set.fontColor;
            set.linkFontColor = null === set.linkFontColor ? "rgb(0,0,0)" : set.linkFontColor;
            set.headlineFontColor = null === set.headlineFontColor ? "rgb(0,0,0)" : set.headlineFontColor;
            set.borderColor = null === set.borderColor ? "rgb(0,0,0)" : set.borderColor;
            var contrastFontColor = Mirando.Color.contrast(set.backgroundColor, set.fontColor),
                contrastLinkFontColor = Mirando.Color.contrast(set.backgroundColor, set.linkFontColor),
                contrastHeadlineFontColor = Mirando.Color.contrast(set.backgroundColor, set.headlineFontColor);

            if (contrastFontColor < 3.5 || contrastLinkFontColor < 3.5 || contrastHeadlineFontColor < 3.5) {
                continue;
            }

            return set;
        }

        return fallbackSet;
    },

    /**
     * @param {Array} colorTuples
     * @param {Number} minWeightPercent
     * @param {Boolean} ignoreBlackWhite
     * @param {Boolean} colors
     * @returns {Object}
     * @private
     */
    _findExtraOrdinaryColorInTuples: function (colorTuples, minWeightPercent, ignoreBlackWhite, ignoreColors) {
        colorTuples = this.makeTupleWeightPercent(colorTuples);
        var colors = colorTuples.filter(function (tuple) {
            return tuple[1] > minWeightPercent;
        }).map(function (tuple) {
            return tuple[0];
        });

        return Mirando.Color.findExtraOrdinaryColor(colors, ignoreBlackWhite, ignoreColors);
    },

    /**
     * @returns {null|Object}
     * @private
     */
    _findTypicalExtraOrdinaryColor: function (analyze) {
        var keys = ['fontColors', 'linkFontColors', 'headlineFontColors', 'borderColors'];
        var foundColors = {};

        for (var analyzeKey in analyze) {
            if (keys.indexOf(analyzeKey) < 0) {
                continue;
            }

            var colorTuples = analyze[analyzeKey];
            colorTuples.forEach(function (colorTuple) {
                var color = colorTuple[0];
                try {
                    if (!Mirando.Color.isGreyOrBlackOrWhite(color) && !Mirando.Color.isTransparent(color)) {
                        var colorKey = Mirando.Color.toColorString(Mirando.Color.parse(color));
                        if (!(colorKey in foundColors)) {
                            foundColors[colorKey] = 0;
                        }
                        foundColors[colorKey] += colorTuple[1];
                    }
                }
                catch (e) {
                }
            });
        }

        var maxWeight = 0;
        var maxColor = null;

        for (var colorKey in foundColors) {
            if (foundColors[colorKey] > maxWeight) {
                maxWeight = foundColors[colorKey];
                maxColor = colorKey;
            }
        }

        return maxColor;
    },

    /**
     * @param {Array} tuples
     * @returns {Array}
     */
    makeTupleWeightPercent: function (tuples) {
        var total = 0;
        tuples.forEach(function (tuple) {
            total += tuple[1];
        });

        return tuples.map(function (tuple) {
            return [tuple[0], tuple[1] * 100.0 / total];
        });
    },

    /**
     * @param {Object} topElement
     * @param {String} analyzeName
     * @private
     */
    _analyze: function (topElement, analyzeName) {
        var filterTagNames = ['html', 'head', 'meta', 'script', 'style'];
        var filterTagNameFunc = function (elements) {
            return [].filter.call(elements, function (elem) {
                return filterTagNames.indexOf(elem.tagName.toLowerCase()) < 0
            });
        };

        this._analyzes[analyzeName] = {};
        this.allElements = filterTagNameFunc(topElement.getElementsByTagName("*"));
        this.headlineElements = topElement.querySelectorAll('h1,h2,h3,h4,h5,h6');
        this.linkElements = topElement.getElementsByTagName("a");

        this._calculateFontColors(analyzeName);
        this._calculateFonts(analyzeName);
        this._calculateFontSizes(analyzeName);
        this._calculateBorderColors(analyzeName);
        this._calculateBorderWidths(analyzeName);
        this._calculateHeadlineFontColors(analyzeName);
        this._calculateHeadlineFonts(analyzeName);
        this._calculateHeadlineFontSizes(analyzeName);
        this._calculateHeadlineTextDecorations(analyzeName);
        this._calculateLinkFontColors(analyzeName);
        this._calculateLinkFonts(analyzeName);
        this._calculateLinkFontSizes(analyzeName);
        this._calculateLinkTextDecorations(analyzeName);
        this._calculateBackgroundColors(analyzeName);
        this._calculateHeadlineFontWeights(analyzeName);
        this._calculateLinkFontWeight(analyzeName);

        this._finished = true;
        this._finishCalbacks.forEach(function (callbackFunction) {
            callbackFunction();
        });
    },

    /**
     * @param {Object} element
     * @returns {number}
     * @private
     */
    _textWeightFunction: function (element) {
        var weight = 0;

        element.childNodes.forEach(function (node) {
            if (node.nodeName === "#text") {
                weight += node.nodeValue.trim().length;
            }
        });

        if (weight === 0 && typeof element.innerText !== 'undefined') {
            //fallback rate by inner text if no text nodes are found
            weight += element.innerText.trim().replace(' ', '').length;
        }

        if (weight === 0) {
            return 0;
        }

        var invalidTagnames = ["h1","h2","h3","h4","h5","h6","a"];
        var checkElement = element;
        while(checkElement) {
            if (invalidTagnames.indexOf(checkElement.tagName.toLowerCase()) >= 0) {
                return 0;
            }
            checkElement = checkElement.parentElement;
        }

        return Math.sqrt(weight);
    },

    /**
     * @param {Object} element
     * @returns {number}
     * @private
     */
    _textWeightTotalFunction: function (element) {
        return element.textContent.trim().length;
    },

    /**
     * @param {Object} element
     * @returns {number}
     * @private
     */
    _dimensionWeightRegressiveFunction: function (element) {
        return Math.sqrt(element.getBoundingClientRect().height * element.getBoundingClientRect().width);
    },

    /**
     * @param {Object} element
     * @returns {number}
     * @private
     */
    _countWeightFunction: function (element) {
        return 1;
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateFontColors: function (analyzeName) {
        this._analyzes[analyzeName]["fontColors"] = this._findTypicalValues(
            this.allElements,
            ["color"],
            this._textWeightFunction
        );
    },
    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateFonts: function (analyzeName) {
        this._analyzes[analyzeName]["fonts"] = this._findTypicalValues(
            this.allElements,
            ["font-family"],
            this._textWeightFunction
        );
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateFontSizes: function (analyzeName) {
        this._analyzes[analyzeName]["fontSizes"] = this._findTypicalValues(
            this.allElements,
            ["font-size"],
            this._textWeightFunction
        );
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateBorderColors: function (analyzeName) {
        this._analyzes[analyzeName]["borderColors"] = this._findTypicalValues(
            this.allElements,
            ["border-bottom-color", "border-right-color", "border-left-color", "border-top-color", "border-color"],
            this._dimensionWeightRegressiveFunction
        );
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateBorderWidths: function (analyzeName) {
        this._analyzes[analyzeName]["borderWidths"] = this._findTypicalValues(
            this.allElements,
            ["border-bottom-width", "border-right-width", "border-left-width", "border-top-width", "border-width"],
            this._dimensionWeightRegressiveFunction,
            ["0px"]
        );
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateHeadlineFontColors: function (analyzeName) {
        this._analyzes[analyzeName]["headlineFontColors"] = this._findTypicalValues(
            this.headlineElements,
            ["color"],
            this._textWeightTotalFunction
        );
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateHeadlineFonts: function (analyzeName) {
        this._analyzes[analyzeName]["headlineFonts"] = this._findTypicalValues(
            this.headlineElements,
            ["font-family"],
            this._textWeightTotalFunction
        );
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateHeadlineFontSizes: function (analyzeName) {
        this._analyzes[analyzeName]["headlineFontSizes"] = this._findTypicalValues(
            this.headlineElements,
            ["font-size"],
            this._textWeightTotalFunction
        );
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateHeadlineFontWeights: function (analyzeName) {
        this._analyzes[analyzeName]["headlineFontWeights"] = this._findTypicalValues(
            this.headlineElements,
            ["font-weight"],
            this._textWeightTotalFunction
        );
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateHeadlineTextDecorations: function (analyzeName) {
        this._analyzes[analyzeName]["headlineFontTextDecorations"] = this._findTypicalValues(
            this.headlineElements,
            ["text-decoration"],
            this._textWeightTotalFunction
        );
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateLinkFontColors: function (analyzeName) {
        this._analyzes[analyzeName]["linkFontColors"] = this._findTypicalValues(
            this.linkElements,
            ["color"],
            this._textWeightTotalFunction
        );
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateLinkFonts: function (analyzeName) {
        this._analyzes[analyzeName]["linkFonts"] = this._findTypicalValues(
            this.linkElements,
            ["font-family"],
            this._textWeightTotalFunction
        );
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateLinkFontSizes: function (analyzeName) {
        this._analyzes[analyzeName]["linkFontSizes"] = this._findTypicalValues(
            this.linkElements,
            ["font-size"],
            this._textWeightTotalFunction
        );
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateLinkFontWeight: function (analyzeName) {
        this._analyzes[analyzeName]["linkFontWeights"] = this._findTypicalValues(
            this.linkElements,
            ["font-weight"],
            this._textWeightTotalFunction
        );
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateLinkTextDecorations: function (analyzeName) {
        this._analyzes[analyzeName]["linkFontTextDecorations"] = this._findTypicalValues(
            this.linkElements,
            ["text-decoration"],
            this._textWeightTotalFunction
        );
    },

    /**
     * @param {String} analyzeName
     * @returns {Array}
     * @private
     */
    _calculateBackgroundColors: function (analyzeName) {
        var elements = [].filter.call(this.allElements, function (elem) {
            return elem.tagName.toLowerCase() !== 'body'
        });

        this._analyzes[analyzeName]["backgroundColors"] = this._findTypicalValues(
            elements,
            ["background-color"],
            this._dimensionWeightRegressiveFunction
        );
    },

    /**
     * @param {Array|*} elements
     * @param {Array} properties
     * @param {function} weightFunction
     * @param {Array} ignoreValues
     * @returns {Array}
     * @private
     */
    _findTypicalValues: function (elements, properties, weightFunction, ignoreValues) {
        var foundValues = {},
            ignoreValues = typeof ignoreValues === 'undefined' ? [] : ignoreValues;

        for (var i = 0; i < elements.length; i++) {
            for (var propertyI = 0; propertyI < properties.length; propertyI++) {
                var element = elements[i],
                    foundValue = window.getComputedStyle(element, null).getPropertyValue(properties[propertyI]);
                if (typeof foundValue != 'undefined' && foundValue !== '' && ignoreValues.indexOf(foundValue) < 0) {
                    if (!(foundValue in foundValues)) {
                        foundValues[foundValue] = 0;
                    }
                    foundValues[foundValue] += weightFunction(element);
                }
            }
        }

        return this._sortFoundValues(foundValues);
    },

    /**
     * @param {Array} foundValues
     * @returns {Array}
     * @private
     */
    _sortFoundValues: function (foundValues) {
        var tuples = [];

        for (var key in foundValues) {
            tuples.push([key, foundValues[key]]);
        }

        tuples.sort(function (a, b) {
            a = a[1];
            b = b[1];

            return a > b ? -1 : (a < b ? 1 : 0);
        });

        return tuples;
    }
};

Mirando.Responsive = function (mirandoAd, responsive, maxAreaPercent, admaterialWidth, admaterialHeight, initialScale, yTransFactor, alignRight = false) {
    function adjustToMobile(mirandoAd) {
        mirandoAd.style.marginLeft = '0px';
        mirandoAd.style.left = '0px';
    }

    function resizeAd() {
        var windowWidth = document.documentElement.clientWidth
                || window.innerWidth
                || document.body.clientWidth;

        windowWidth = windowWidth - 20;

        var windowHeight = document.documentElement.clientHeight
                || window.innerHeight
                || document.body.clientHeight;


        var isMobile =  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        /*var screenWidth = screen.availWidth  ? Math.min(screen.availWidth, windowWidth) : windowWidth;
        var screenHeight = screen.availHeight  ? Math.min(screen.availHeight, windowHeight) : windowHeight;*/

        var screenWidth = windowWidth;
        var screenHeight = windowHeight;


        var adArea = admaterialWidth * admaterialHeight * initialScale;
        var displayArea = screenWidth * screenHeight;

        var areaScaleFactor = 1.0;
        if (maxAreaPercent) {
            areaScaleFactor = Math.sqrt((maxAreaPercent / 100.0) / (adArea / displayArea));
        }
        var widthScaleFactor = 1.0;
        if (responsive) {
            widthScaleFactor = screenWidth / (admaterialWidth * initialScale);
        }

        var scaleFactor = Math.min(areaScaleFactor, widthScaleFactor);

        var scale = initialScale;
        if (scaleFactor < 1.0) {
            scale = scale * scaleFactor;
        }

        if (mirandoAd.dataset.addscale) {
          scale = scale * parseFloat(mirandoAd.dataset.addscale);
        }

        var transY = (admaterialHeight / 2) * yTransFactor - ((admaterialHeight / 2) * yTransFactor * scale);

        var transX = 0;
// JP removed these lines on 16.11.2023 at 22:30 
//        if (isMobile && !alignRight) {
//            adjustToMobile(mirandoAd);
//            transX = (-1) * ((admaterialWidth / 2) - ((admaterialWidth / 2) * scale));
//        }

        if (alignRight) {
            transX = ((admaterialWidth / 2) - ((admaterialWidth / 2) * scale));
        }

        mirandoAd.style.transform = "translate(" + transX + "px, " + transY + "px) scale(" + scale + ")";
        mirandoAd.style.webkitTransform = "translate(" + transX + "px, " + transY + "px) scale(" + scale + ")";

        mirandoAd.dataset.scale = scale;
    }

    window.addEventListener('resize', function () {
        resizeAd();
    }, true);

    var resizeAdInInterval = function () {
        resizeAd();
        setTimeout(function () {
            resizeAdInInterval();
        }, 100);
    };

    resizeAdInInterval();
};

/**
 * AsyncLoader functions for mirando
 * only one material can be loaded at time
 */
Mirando.AsyncLoader = function () {

    var that = this;
    var scriptsToBeLoaded = 0; //survey for still loading scripts
    var mirGetPlacerCounter = 0; //counter for placers (used for placing)
    var currentDeliverSid = null; //current loading script place //adCounter in Mirando.adLoader
    var lastDeliverSid = null; //last currentDeliverSid active
    var writeCache = ''; //document.write cache
    var currentAdmaterial = null; //current loading admaterial
    var restJsCode = []; //rest js not evaled by common traversing
    var rejecteds = []; //list with rejected admaterial ids
    var faultys = []; //list with admaterial ids, where js code has an error
    var isFallback = false;
    var currentPlacer = []; //dictionary current active placer (script id (wo __mirget)=> placer id)
    var rejectsActive = []; //dictionary current rejects wtaching for reject signal (script id (wo __mirget)=> admaterialId)
    var rejectsDone = []; //dictionary with lists with current rejects done  (script id (wo __mirget)=> list with admaterialIds)
    var waitForPrioDeliv = 0; //counter waiting for prio delivery (for forcing delivery in right order 1,2,3,4,...)
    var lastAdmaterials = []; //dictionary with lists with last admaterial delivered (script id (wo __mirget)=> admaterialId)
    var deliversDone = []; //dictionary with lists with last admaterial delivered (script id (wo __mirget)=> admaterialId)
    var knownSources = []; //array with script urls which can use the overload document write function
    var asyncRejectViewtrackings = []; //array with script id (wo __mirget)### admaterial id => timestamp ### tracking pixel url
    var asyncRejectViewtrackingTestRunning = false; //ist code for test reject done
    var admPlaceCount = 0; //how many admaterials already loadeds
    var repositoryRequestSent = false; //is a normal repository request sent
    var sidsWaitForDocumentReady = []; //dictionary with script ids must waiting for document ready (script id => bool)
    var callbacks = []; //callbacks after admaterial finished loading (script id => callback function name)

    this.increaseScriptsToBeLoaded = function () {
        scriptsToBeLoaded++;
    };
    this.decreaseScriptsToBeLoaded = function () {
        scriptsToBeLoaded--;
        if (scriptsToBeLoaded < 0) {
            console.log('decreaseScriptsToBeLoaded underflow');
            scriptsToBeLoaded = 0;
        }
    };
    this.getScriptsToBeLoaded = function () {
        return scriptsToBeLoaded;
    };

    this.getRepositoryRequestSent = function () {
        return repositoryRequestSent;
    };

    this.setRepositoryRequestSent = function (newRepositoryRequestSent) {
        repositoryRequestSent = newRepositoryRequestSent;
    };

    this.setCurrentPlacer = function(scriptId, placerElementId) {
        currentPlacer[scriptId] = placerElementId;
    };

    this.getCurrentAdmaterialId = function () {
        return currentAdmaterial;
    };

    /**
     * set by adloader to force watit for document ready after repository request
     * @param {string} scriptId
     */
    this.markScriptIdForDocumentReady = function (scriptId) {
        sidsWaitForDocumentReady[scriptId] = true;
    };

    this.setCallbackForScriptId = function (scriptId, callbackFunctionName) {
        callbacks[scriptId] = callbackFunctionName;
    };

    this.getDeliveredAdmaterialIdsForScriptIndex = function (scriptIndex) {
        if (scriptIndex in deliversDone) {
            return deliversDone[scriptIndex];
        }

        return [];
    };


    //write cache for document.write overload
    this.pushWriteCache = function (pushStr) {
        if (currentAdmaterial &&
            (pushStr.indexOf('rejectDelivery' + currentAdmaterial + "();") >= 0 || pushStr.indexOf('rejectDelivery' + currentAdmaterial + " ();") >= 0)) {
            rejecteds[currentDeliverSid] = true;
        }
        var NOSCRIPT_REGEX = /<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi;
        while (NOSCRIPT_REGEX.test(pushStr)) {
            pushStr = pushStr.replace(NOSCRIPT_REGEX, "");
        }

        writeCache += pushStr;
    };

    this.execute = function (func) {
        (function () {
            func();
        })();
    };

    //helper function for checking valid source of docment.write overload
    this.isValidSource = function (stackTrace) {
        if (!stackTrace) {
            //fallback for internet explorer
            var stackTraceCode = "";
            var caller = arguments.callee.caller;
            var i = 0;
            var stacktraceCodes = [];

            while (caller && i < 15) {
                stacktraceCodes.push(caller);
                caller = caller.caller;
                i++;
            }

            var totalStracktrace = stacktraceCodes.join(' ');
            if (totalStracktrace.indexOf('mirInsertHtmlDynamicStartVar') >= 0 || totalStracktrace.indexOf('mirInsertJsDynamicStart') >= 0 || stacktraceCodes.length <= 1) {
                return true;
            }

            if (!isValid)
                console.log('invalid source' + stackTrace);

            if (mirandoJsDebug) {
                console.log('isValidSource');
                for (var i in stacktraceCodes) {
                    console.log(stacktraceCodes[i]);
                }
            }

            return false;
        }

        var laststackTraceRow = stackTrace.split(/\n/);
        laststackTraceRow = laststackTraceRow[laststackTraceRow.length - 1];

        var isValid = false;
        if (stackTrace) {
            for (var i in knownSources) {
                if (laststackTraceRow.indexOf(knownSources[i]) >= 0 || laststackTraceRow.indexOf('mirando.js')) {
                    isValid = true;
                    break;
                }
            }
        }
        else
            isValid = true;
        if (!isValid)
            console.log('invalid source' + stackTrace);

        return isValid;
    };

    /**
     * insert html inside or before el and traverse the html and eval js code
     * @param el
     * @param str
     * @param doInsertBefore
     */
    this.insertHtmlDynamic = function (el, str, doInsertBefore) {
        var mirInsertHtmlDynamicStartVar = 'mirInsertHtmlDynamicStartVar';//do not remove marker for isValidSource
        mirInsertHtmlDynamicStartVar += '';//do not remove marker for isValidSource!!!!
        if (el === null) {
            debugger;
            return;
        }
        if (el === null && mirandoJsDebug) {
            console.log('null el in insertHtmlDynamic (' + currentAdmaterial + ')');
        }

        var elemConstructorName = (el).constructor.toString();

        if (typeof str === "function") {

            try {
                str(); //exceute function
                var _writeCache = '' + writeCache;
                writeCache = '';
                mirandoAsyncLoader.insertBeforeHtml(el, _writeCache); //pop wirte cache and insert
            }
            catch (e) {
                //error in js
                console.log('error in insertHtmlDynamic execute str (' + currentAdmaterial + '):' + e.message);
                mirandoAsyncLoader.log({
                    t: "error",
                    adm: currentAdmaterial,
                    url: encodeURIComponent(window.location.href)
                });
                if (str.length > 10000)
                    console.log(str.substr(0, 10000) + '....');
                else
                    console.log(str);
                faultys[currentDeliverSid] = true;
            }
        }
        else {
            var div = document.createElement('div');
            div.innerHTML = str;

            var childNodes = [];
            for (var i = 0; i < div.childNodes.length; i++) {
                childNodes.push(div.childNodes[i]);
            }

            var regexViewTrackpixel = new RegExp(hostForMirandoJs + '\/track\/[0-9]*?\/[0-9]*?\/.*?\/view', 'i');

            for (var i = 0; i < childNodes.length; i++) {
                var childNode = childNodes[i];

                var childNodeElemConstructorName = (childNode).constructor.toString();
                if (childNodeElemConstructorName.indexOf('HTMLScriptElement') >= 0 && childNode.src) {
                    //external script js
                    //append external javascript add the end of the body
                    this.insertJsScriptElement(childNode, el, doInsertBefore);
                }
                else if (childNodeElemConstructorName.indexOf('HTMLScriptElement') >= 0 && !childNode.src) {
                    //read and execute inline javascript snippet
                    var jsCode = childNode.innerHTML;
                    if (doInsertBefore) {
                        el.parentNode.insertBefore(childNode, el);
                    }
                    else {
                        el.appendChild(childNode);
                    }

                    //remove cdata
                    jsCode = jsCode.replace(/(?:\r\n|\r|\n)/g, '#x#NEWLINE#x#');
                    var myRegexp = /<!\s*?\[\s*?CDATA\s*?\[(.*?)]]\s*?>/g;
                    var match = myRegexp.exec(jsCode);
                    if (match != null && match[1])
                        jsCode = match[1];
                    jsCode = jsCode.replace(/^\s+|\s+$/g, ""); //trim
                    jsCode = jsCode.replace("$(document).ready(function()", "mirandoAsyncLoader.execute(function()");
                    if (jsCode.substr(0, 2) == '*/')
                        jsCode = jsCode.substr(2);
                    if (jsCode.substr(-2) == '/*')
                        jsCode = jsCode.substr(0, jsCode.length - 2);
                    jsCode = jsCode.replace(/#x#NEWLINE#x#/g, '\n');

                    try {
                        if (mirandoAsyncLoader.getScriptsToBeLoaded() > 0) {
                            //code should be exexuted after all scrits finished loading
                            restJsCode.push([doInsertBefore, doInsertBefore ? childNode : el, jsCode]);
                        }
                        else {
                            window.eval(jsCode);

                            if (writeCache != '') {
                                //console.log(writeCache);
                                //alert(writeCache);
                                //put document write cache to output
                                var _writeCache = '' + writeCache;
                                writeCache = '';
                                if (doInsertBefore)
                                    mirandoAsyncLoader.insertBeforeHtml(childNode, _writeCache);
                                else
                                    mirandoAsyncLoader.insertInsideHtml(el, _writeCache);
                            }
                        }
                    }
                    catch (e) {
                        console.log('error in insertHtmlDynamic window.eval (' + currentAdmaterial + '):' + e.message);
                        mirandoAsyncLoader.log({
                            t: "error",
                            adm: currentAdmaterial,
                            url: encodeURIComponent(window.location.href)
                        });
                        if (jsCode.length > 100000)
                            console.log(jsCode.substr(0, 100000) + '....');
                        else
                            console.log(jsCode);
                        faultys[currentDeliverSid] = true;
                    }
                }
                else if (childNode.nodeType == Node.TEXT_NODE || childNode.nodeName.toLowerCase() == 'style') {
                    //ordinary text node or style node
                    if (el.nodeType != Node.COMMENT_NODE) {
                        if (doInsertBefore) {
                            el.parentNode.insertBefore(childNode, el);
                        }
                        else {
                            el.appendChild(childNode);
                        }
                    }
                }

                else if (childNode.nodeName.toLowerCase() == 'svg' || childNode.nodeName.toLowerCase() == 'img') {
                    if (doInsertBefore) {
                        el.parentNode.insertBefore(childNode, el);
                    }
                    else {
                        el.appendChild(childNode);
                    }
                }
                else {
                    // rest html traversed recursively
                    var iHtml = childNode.innerHTML;
                    childNode.innerHTML = "";
                    if (doInsertBefore) {
                        el.parentNode.insertBefore(childNode, el);
                        this.insertInsideHtml(el.previousSibling, iHtml);
                    }
                    else {
                        el.appendChild(childNode);
                        this.insertInsideHtml(el.lastChild, iHtml);
                    }
                }
            }
        }
    };

    /**
     * insert a js scriptNode at the end of body
     * used by insertHtmlDynamic
     *
     * @param placerElement
     * @param str
     * @param doInsertBefore
     */
    this.insertJsScriptElement = function (scriptNode, placerElement, doInsertBefore) {
        var elemConstructorName = (placerElement).constructor.toString();

        var se = document.createElement('script');
        se.type = 'text/javascript';
        var scripSrc = scriptNode.src;

        if (location.protocol.indexOf('https') >= 0 && scripSrc.indexOf('http://') === 0) {
            //force https if webpage is httpd loading to prevent mixed failure
            scripSrc = scripSrc.replace('http://', 'https://');
        }

        var isScriptAsync = (scriptNode.outerHTML.toLowerCase().indexOf('async') > 0);

        if (scripSrc.indexOf('lrsitebarliebemannbulli') >= 0 || scripSrc.indexOf('lrbbliebemannbulli') >= 0) {
            //dirty fix for cosmos sitebar
            isScriptAsync = false;
        }

        knownSources.push(scripSrc.split('#')[0]);

        se.src = scripSrc;

        if (scriptNode.id) {
            se.id = scriptNode.id;
        }

        var isRepositoryRequestSent = (se.src.indexOf(hostForMirandoJs + '/repository/') >= 0);
        var isFallback = (isRepositoryRequestSent && se.src.indexOf('as=1') < 0);

        if (se.src.indexOf('mirando.js') < 0 && !isFallback && !isScriptAsync) {
            mirandoAsyncLoader.increaseScriptsToBeLoaded();
            se.onload = function () {
                if (writeCache != '') {
                    //put document write cache to output
                    var _writeCache = '' + writeCache;
                    writeCache = '';
                    mirandoAsyncLoader.insertBeforeHtml(se, _writeCache);
                }
                mirandoAsyncLoader.decreaseScriptsToBeLoaded();
            };
            se.onerror = function () {
                mirandoAsyncLoader.decreaseScriptsToBeLoaded();
            };
        }
        else if (!isFallback && isRepositoryRequestSent) {
            repositoryRequestSent = true;
            se.onload = function () {
                repositoryRequestSent = false;
            };
        }

        if (isFallback) {
            if (mirandoJsDebug) {
                console.log('initiating fallback for admaterial ' + currentAdmaterial + ' on tag __mirget' + currentDeliverSid);
            }

            //special case repository request for fallback
            this.makeFallbackRepositoryRequestByScript(se, currentDeliverSid);
        }
        else if (se.src.indexOf('mirando.js') >= 0) {
            //special case mirando.js in mirando.js //i.e for 2 in 1
            doInsertBefore = false;
            if (elemConstructorName.indexOf('HTMLScriptElement') >= 0)
                doInsertBefore = true;

            mirandoAsyncLoader.insertMirandoJsAsync(se, placerElement, doInsertBefore);
        }
        else if (doInsertBefore) {
            placerElement.parentNode.insertBefore(se, placerElement);
            se = placerElement.previousSibling;
        }
        else {
            placerElement.appendChild(se);
            placerElement = placerElement.lastChild;
        }
    };

    this.makeFallbackRepositoryRequestByScript = function (se, deliverSid) {
        var asyncRepositoryRequestFunc = function () {
            mirandoAsyncLoader.setRepositoryRequestSent(true);

            se.onload = function () {
                mirandoAsyncLoader.setRepositoryRequestSent(false);
            };
            se.onerror = function () {
                mirandoAsyncLoader.setRepositoryRequestSent(false);
            };

            se.src = se.src + "&as=1&sid=__mirfb" + deliverSid;
            se.async = true;
            document.body.appendChild(se);
        };

        this.renderRepositoryRequestAsyncWithFunction(asyncRepositoryRequestFunc);
    };

    /**
     * insert mirando.js script with placer element within or before certain elem
     *
     * @param se
     * @param el
     * @param doInsertBefore
     */
    this.insertMirandoJsAsync = function (se, el, doInsertBefore) {
        se.async = true;
        if (se.src.indexOf('as=0') >= 0) {
            se.src = se.src.replace('as=0', 'as=1');
        }
        else if (se.src.indexOf('as=1') <= 0) {
            se.src = se.src + '&as=1';
        }

        if (hostForMirandoJs.indexOf('get.mirando.devx:9010') >= 0) {
            se.src = se.src.replace('https', 'http');
        }

        var retryTime = -1;
        var currentRetryTime = 0;
        var maxRetryTime = 10000;

        if (se.src.indexOf('&at=34') >= 0) {
            retryTime = 500;
        }

        function deliverMirandoJsDelayed() {
            if (retryTime > 0 && currentRetryTime < maxRetryTime
                && (mirandoAsyncLoader.getRepositoryRequestSent() || mirandoAsyncLoader.getScriptsToBeLoaded() > 0 || currentAdmaterial !== null)) {

                currentRetryTime += retryTime;
                setTimeout(function () {
                    deliverMirandoJsDelayed();
                }, retryTime);
            }
            else {

                mirGetPlacerCounter++;
                var mirjsPlacerDiv = document.createElement('span');
                mirjsPlacerDiv.id = "__mirget_placer_" + mirGetPlacerCounter;
                mirjsPlacerDiv.style.display = 'none';
                se.src = se.src + '&placer=' + mirjsPlacerDiv.id;
                currentPlacer[currentDeliverSid] = mirjsPlacerDiv.id;

                if (doInsertBefore) {
                    //script loaded by other script (appended adplaces ...)
                    el.parentNode.insertBefore(mirjsPlacerDiv, el);
                }
                else {
                    // script in html container (2 in 1 ....)
                    el.appendChild(mirjsPlacerDiv);
                }

                document.body.appendChild(se);

            }
        }

        deliverMirandoJsDelayed();
    };

    //helper function for eval rest js codes
    this.insertJsDynamic = function (el, jsCode, doInsertBefore) {
        var mirInsertJsDynamicStart = 'mirInsertJsDynamicStart';//do not remove marker for isValidSource!!!!
        mirInsertJsDynamicStart += '';//do not remove marker for isValidSource!!!!
        try {
            window.eval(jsCode);
            if (writeCache != '') {
                var _writeCache = '' + writeCache;
                writeCache = '';
                if (doInsertBefore)
                    mirandoAsyncLoader.insertBeforeHtml(el, _writeCache);
                else
                    mirandoAsyncLoader.insertInsideHtml(el, _writeCache);
            }
        }
        catch (e) {
            console.log('error in insertJsDynamic window.eval (' + currentAdmaterial + '):' + e.message);
            if (jsCode.length > 100000)
                console.log(jsCode.substr(0, 100000) + '....');
            else
                console.log(jsCode);
            faultys[currentDeliverSid] = true;
        }
    };

    this.insertBeforeHtml = function (el, str) {
        this.insertHtmlDynamic(el, str, true);
    };

    this.insertInsideHtml = function (el, str) {
        this.insertHtmlDynamic(el, str, false);
    };

    this.appendFallbackByUrl = function (rejectAdmaterialId, url) {
        var script = '<script type="text/javascript" src="' + url + '"></script>';
        mirandoAsyncLoader.appendFallbackScript(rejectAdmaterialId, script);
    };

    //used by du for repository requests with exclude materials (initiated by reject)
    this.appendFallbackScript = function (rejectAdmaterialId, str) {
        var self = this;

        var e = document.createElement('div');
        e.innerHTML = str;

        var se = document.createElement('script');
        se.type = 'text/javascript';
        se.async = true;
        se.src = e.childNodes[0].src;

        //add display sizes/browser sizes parameters
        se.src += self.getAdditionalQueryParameters();

        var sid = parseInt(this.getParameterByName('sid', se.src).replace('__mirfb', ''));
        var excludeMaterials = this.getParameterByName('excludeMaterials', se.src);

        var fallbackSid = sid;
        var directReject = true;

        var rejectMessage = "Reject(" + rejectAdmaterialId + ")";

        if (lastAdmaterials[fallbackSid] != rejectAdmaterialId || (fallbackSid in rejectsDone && rejectAdmaterialId in rejectsDone[fallbackSid])) {
            //last admaterial not lastRejectAdmaterialId or already rejeject => try to find other place to deliver
            //debugger;
            fallbackSid = null;
            for (var altSid in lastAdmaterials) {
                if (lastAdmaterials[altSid] == rejectAdmaterialId && !(altSid in rejectsDone && rejectAdmaterialId in rejectsDone[altSid])) {
                    //rewrite script src to deliver on other place

                    rejectMessage = "Swap reject(" + rejectAdmaterialId + ")";
                    rejectMessage += " switched from " + sid;
                    se.src = se.src.replace('__mirfb' + sid, '__mirfb' + altSid);
                    fallbackSid = altSid;
                    break;
                }
            }
            if (fallbackSid === null) {
                fallbackSid = sid;
                console.log('!!!!Reject place for (' + rejectAdmaterialId + ') cannot be found');
            }
        }


        //create reject done entry
        if (!(fallbackSid in rejectsDone))
            rejectsDone[fallbackSid] = [];
        if (!(rejectAdmaterialId in rejectsDone[fallbackSid]))
            rejectsDone[fallbackSid][rejectAdmaterialId] = true;

        if (fallbackSid + '###' + rejectAdmaterialId in asyncRejectViewtrackings) {
            delete asyncRejectViewtrackings[fallbackSid + '###' + rejectAdmaterialId];
        }

        //delete active reject
        if (fallbackSid in rejectsActive)
            delete rejectsActive[fallbackSid];

        if (mirandoJsDebug) {
            document.getElementById("mirandoJsDebug" + fallbackSid).innerHTML = document.getElementById("mirandoJsDebug" + fallbackSid).innerHTML + "<br>" + rejectMessage;
        }

        //hide first previous element with mirThirdParty cotainer div
        var prev = document.getElementById("__mirget" + fallbackSid).previousSibling;
        if (fallbackSid in currentPlacer) {
            // if for currentDeliverSid a placer is set use it instead
            if (document.getElementById(currentPlacer[fallbackSid]))
                prev = document.getElementById(currentPlacer[fallbackSid]).previousSibling;
        }

        var found = false;
        while (prev && !found) {
            if (prev.id && prev.id.indexOf('mirThirdParty') == 0 && prev.style.display != 'none') {
                found = true;
                prev.style.display = 'none';
            }
            else
                prev = prev.previousSibling;
        }

        document.body.appendChild(se);
    };

    /**
     * main function called by repository request
     * @param {string} sid
     * @param {int} admaterialId
     * @param {string} str
     */
    this.insertAsyncHtml = function (sid, admaterialId, str) {
        if (mirandoJsDebug)
            console.log('load async admaterial ' + admaterialId + ' on tag ' + sid);
        var deliverIndex = parseInt(sid.replace('__mirget', '').replace('__mirfb', '').replace('dyn-mir-ad-', ''));
        var _isFallback = false;
        if (sid.indexOf('__mirfb') >= 0) {
            sid = sid.replace('__mirfb', '__mirget');
            _isFallback = true;
        }

        function startAsyncHtml() {

            var mustWaitForDocumentReady = sid in sidsWaitForDocumentReady && sidsWaitForDocumentReady[sid] && document.readyState !== 'complete';

            if (mirandoAsyncLoader.getScriptsToBeLoaded() > 0 || currentAdmaterial !== null || mustWaitForDocumentReady) {
                //wait for current admaterial to be finished;
                setTimeout(function () {
                    startAsyncHtml();
                }, 2);
            }
            else {
                waitForPrioDeliv = 0;
                currentAdmaterial = admaterialId;
                isFallback = _isFallback;
                currentDeliverSid = deliverIndex;
                document.baseDocumentWrite = document.write;
                document.baseDocumentWriteln = document.writeln;
                var baseDocumentWrite = document.write;
                var baseDocumentWriteln = document.writeln;
                var se = document.getElementById(sid);

                lastAdmaterials[currentDeliverSid] = currentAdmaterial;
                admPlaceCount++;

                //check for double deliver
                if (currentDeliverSid in deliversDone && currentAdmaterial in deliversDone[currentDeliverSid]) {
                    mirandoAdLoader.viewportCheck('async double load sid:' + currentDeliverSid, currentAdmaterial);
                    return;
                }

                //create deliver done entry
                if (!(currentDeliverSid in deliversDone))
                    deliversDone[currentDeliverSid] = [];
                if (!(currentAdmaterial in deliversDone[currentDeliverSid]))
                    deliversDone[currentDeliverSid].push(currentAdmaterial);


                //overwite document write functions
                document.write = function (html) {
                    //capture document write to cache
                    if (mirandoAsyncLoader.isValidSource((new Error()).stack)) {
                        mirandoAsyncLoader.pushWriteCache(html);
                    }
                    else {
                        document.baseDocumentWrite(html);
                    }
                };
                document.writeln = function (html) {
                    //capture document writeln to cache
                    if (mirandoAsyncLoader.isValidSource((new Error()).stack)) {
                        mirandoAsyncLoader.pushWriteCache(html + '\n');
                    }
                    else {
                        document.baseDocumentWriteln(html);
                    }
                };

                if (currentDeliverSid in currentPlacer) {
                    // if for currentDeliverSid a placer is set use it instead script element for further placing (i.e for fallback in appendFallbackScript)
                    se = document.getElementById(currentPlacer[currentDeliverSid]);
                }

                if (mirandoJsDebug)
                    console.log('start async admaterial ' + admaterialId + ' on tag ' + sid);
                mirandoAsyncLoader.log({t: "start", adm: admaterialId, url: encodeURIComponent(window.location.href)});

                if (mirandoJsDebug) {
                    var adplaceId = mirandoAdLoader.getAdplaceByAdCounter(currentDeliverSid);

                    if (isFallback)
                        document.getElementById("mirandoJsDebug" + currentDeliverSid).innerHTML = document.getElementById("mirandoJsDebug" + currentDeliverSid).innerHTML + "<br>Fallback: " + currentAdmaterial + '(' + admPlaceCount + ')';
                    else
                        mirandoAsyncLoader.insertBeforeHtml(se, "<div id='mirandoJsDebug" + currentDeliverSid + "' style='padding:3px;border 1px solid black;background-color: #DDDDDD;width:130px;margin:1px;font-size:small'>Mirando Debug<br>Script Id:" + currentDeliverSid + "<br>Adplace Id:" + adplaceId + "<br>Admaterial:" + admaterialId + "(" + admPlaceCount + ")</div>");
                }

                mirandoAsyncLoader.insertBeforeHtml(se, str);
                function waitAsyncHtml() {
                    if (mirandoAsyncLoader.getScriptsToBeLoaded() > 0) {
                        setTimeout(function () {
                            waitAsyncHtml();
                        }, 1);
                    }
                    else if (restJsCode.length > 0) {
                        //exectute rest js code
                        _restJsCode = restJsCode.slice(0);
                        restJsCode = [];
                        for (i = 0; i < _restJsCode.length; i++) {
                            mirandoAsyncLoader.insertJsDynamic(_restJsCode[i][1], _restJsCode[i][2], _restJsCode[i][0]);
                        }
                        setTimeout(function () {
                            waitAsyncHtml();
                        }, 1);
                    }
                    else {
                        //end of loading
                        if (typeof "rejectDelivery" + currentAdmaterial != 'undefined') {
                            if (!(currentDeliverSid in rejectsDone) || !(currentAdmaterial in rejectsDone[currentDeliverSid]))
                                rejectsActive[currentDeliverSid] = currentAdmaterial; //store reject active if not already rejected
                        }

                        //release overwritten document writes
                        document.write = baseDocumentWrite;
                        document.writeln = baseDocumentWriteln;

                        if (mirandoJsDebug) {
                            console.log('finish async admaterial ' + admaterialId + ' on tag ' + sid);
                        }

                        if (sid in callbacks) {
                            var callbackFunctionName = callbacks[sid];

                            if (eval("typeof " + callbackFunctionName + "== 'function'")) {
                                eval(callbackFunctionName + '(true);');
                            }
                        }

                        mirandoAsyncLoader.log({
                            t: "end",
                            adm: admaterialId,
                            url: encodeURIComponent(window.location.href)
                        });
                        if (mirandoJsDebug) {
                            if (!(currentDeliverSid in rejecteds))
                                document.getElementById("mirandoJsDebug" + currentDeliverSid).innerHTML = document.getElementById("mirandoJsDebug" + currentDeliverSid).innerHTML + "<br>Finished";
                            for (var rejected in rejecteds) {
                                if (document.getElementById("mirandoJsDebug" + rejected) === null) {
                                    console.log("mirandoJsDebug " + rejected + " not found for rejected");
                                }
                                else
                                    document.getElementById("mirandoJsDebug" + rejected).innerHTML = document.getElementById("mirandoJsDebug" + rejected).innerHTML + "<br>REJECTED!";
                            }
                            for (var faulty in faultys) {
                                if (document.getElementById("mirandoJsDebug" + faulty) === null) {
                                    console.log("mirandoJsDebug " + rejected + " not found for faulty");
                                }
                                else
                                    document.getElementById("mirandoJsDebug" + faulty).innerHTML = document.getElementById("mirandoJsDebug" + faulty).innerHTML + "<br>ERROR IN JS CHECK LOGS!";
                            }
                            rejecteds = [];
                            faultys = [];
                        }
                        currentAdmaterial = null;
                        lastDeliverSid = currentDeliverSid;
                        currentDeliverSid = null;

                        if (!asyncRejectViewtrackingTestRunning && Object.keys(asyncRejectViewtrackings).length > 0) {
                            mirandoAsyncLoader.testAddAsyncRejectViewtrackings();
                        }
                    }
                }

                waitAsyncHtml();
            }
        }

        startAsyncHtml();
    };

    this.log = function (params) {
        if (typeof mirandoAsyncLog !== 'undefined') {
            var logReqUrl = mirandoAsyncLog + '?a=1';
            for (var k in params) {
                logReqUrl = logReqUrl + "&" + k + "=" + params[k];
            }
            var trackpix = document.createElement("img");
            trackpix.setAttribute('src', logReqUrl);
            trackpix.setAttribute('height', '1px');
            trackpix.setAttribute('width', '1px');
            trackpix.style.position = 'absolute';
            trackpix.style.left = '-1000px';
            trackpix.style.top = '-1000px';
            document.body.appendChild(trackpix);
        }
    };


    this.getParameterByName = function (name, url) {
        if (!url) {
            url = window.location.href;
        }
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    };


    //place code in a new iframe; iframe is placed in placeholder div; for envoloping not async possible ads
    this.iframeAd = function (html, placeHolderId, width, height) {
        var placeholderDiv = document.getElementById(placeHolderId);
        var iframeId = "i_" + placeHolderId;

        var iframe = document.createElement('iframe');
        iframe.setAttribute("id", iframeId);
        iframe.setAttribute("width", width);
        iframe.setAttribute("height", height);
        iframe.setAttribute("frameborder", "0");
        iframe.setAttribute("scrolling", "no");
        iframe.setAttribute("marginwidth", "0");
        placeholderDiv.appendChild(iframe);

        iframe = document.getElementById(iframeId);
        var iframedoc = iframe.document;
        if (iframe.contentDocument)
            iframedoc = iframe.contentDocument;
        else if (iframe.contentWindow)
            iframedoc = iframe.contentWindow.document;

        var rows = html.split("\n");

        iframedoc.open();
        for (var i in rows)
            iframedoc.writeln(rows[i]);
        iframedoc.close();
    };

    this.addAsyncRejectViewtrackings = function (admaterialId, scriptId, trackingUrl) {

        var timestamp = (new Date()).getTime();
        var k = scriptId.replace('__mirget', '') + "###" + admaterialId;
        asyncRejectViewtrackings[k] = timestamp + "###" + trackingUrl;
    };

    this.testAddAsyncRejectViewtrackings = function () {
        asyncRejectViewtrackingTestRunning = true;
        var timestamp = (new Date()).getTime();
        for (var k in asyncRejectViewtrackings) {
            //console.log('check ' + k);
            var kSplit = k.split('###');
            var vSplit = asyncRejectViewtrackings[k].split('###');
            var sid = parseInt(kSplit[0]);
            //var admaterialId = parseInt(kSplit[1]);
            var oldTimestamp = parseInt(vSplit[0]);

            if (!(sid in deliversDone) || deliversDone[sid].indexOf(kSplit[1]) < 0) {
                //not yet delivered => prolong timestamp
                //console.log('prolong timestamp ' + k);
                asyncRejectViewtrackings[k] = timestamp + '###' + vSplit[1];
            }
            else if (timestamp - oldTimestamp > 3000) {
                //not rejeted track
                //console.log('not reject track ' + k);
                var vtPix = document.createElement('img');
                vtPix.setAttribute('src', unescape(vSplit[1]));
                document.body.appendChild(vtPix);
                delete(asyncRejectViewtrackings[k]);
            }
        }

        if (Object.keys(asyncRejectViewtrackings).length > 0) {
            setTimeout(function () {
                mirandoAsyncLoader.testAddAsyncRejectViewtrackings()
            }, 50);
        }
        else {
            asyncRejectViewtrackingTestRunning = false;
        }
    };

    this.getAdditionalQueryParameters = function () {
        var queryString = '';

        if (top.location.href != self.location.href) {
            var topdomain;
            if (top.location.href.indexOf("://") > -1)
                topdomain = top.location.href.split('/')[2];
            else
                topdomain = top.location.href.split('/')[0];
            topdomain = topdomain.split(':')[0];
            queryString += "&topfqdn=" + topdomain;
        }

        var dwidth = window.screen.availWidth || -1;
        var dheight = window.screen.availHeight || -1;
        var bwidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        var bheight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
        queryString += "&dwidth=" + dwidth + "&dheight=" + dheight + "&bwidth=" + bwidth + "&bheight=" + bheight;
        return queryString;
    };
};

/**
 * Renders an RepositoryRequest, that is issued via javascript
 */
Mirando.AdRequest = function (adPlaceId, impressionId, instanceId, queryString, scriptId, isAsync) {

    if ('preventMirAd' in window && window.preventMirAd) {
        return;
    }

    var that = this;
    var locationProto = ('http:' == document.location.protocol ? 'http://' : 'https://');
    var urlPattern = locationProto + hostForMirandoJs + '/%{type}/%{adPlaceId}/%{impressionId}/%{instanceId}/?%{queryString}';

    var asyncJs = "";
    if (isAsync) {
        asyncJs = "async ";
    }

    var jsIncludePattern = '<script id="' + scriptId + '" ' + asyncJs + 'type="text/javascript" src="%{url}"][/script]'.replace(/\[/g, '<').replace(/\]/g, '>');

    this.render = function () {
        return renderJsInclude(that.getRequestUrl());
    };

    this.getRequestUrl = function () {
        return renderRequestUrl(adPlaceId, impressionId, queryString);
    };

    function renderJsInclude(url) {
        return jsIncludePattern.replace('%{url}', url);
    }

    function renderRequestUrl(adPlaceId, impressionId, queryString) {
        var type = 'repository';
        var _adplaceId = adPlaceId;
        var _instanceId = instanceId;
        if (adPlaceId < 0) {
            //preview request
            type = 'material';
            _adplaceId = adPlaceId + '/' + adPlaceId;
            _instanceId = 'init';
        }
        return urlPattern.replace('%{type}', type).replace('%{adPlaceId}', _adplaceId).replace('%{impressionId}', impressionId).replace('%{queryString}', queryString).replace('%{instanceId}', _instanceId);
    }
};

Mirando.gdprParser = {
    cookieConsentStatus: null,
    iabTcf2Consent: null,

    hasTcfConsentGiven: (tcData) => {
        let vendor = typeof tcData.vendor === "object" ? (tcData.vendor['consents'] ?? []) : [];
        let consents = typeof tcData.purpose === "object" ? (tcData.purpose['consents'] ?? []) : [];

        if (false === vendor[279] ||
            false === consents[2] ||
            false === consents[7]) {
            return false;
        }

        let legitimate = typeof tcData.purpose === "object" ? (tcData.purpose['legitimateInterests'] ?? []) : [];
        return (true === consents[2] === consents[7] || true === legitimate[2] === legitimate[7]) ;
    },

    init: function () {
       console.info( '%c[Mirando]','color: #33a8e0; padding: 3px 2px; font-style: italic' , 'GPDR parser initialized');

       //cookie consent
       Mirando.gdprParser.cookieConsentStatus = null;
       document.addEventListener('CookieConsentInitialize', function(event) {
          this.cookieConsentStatus = false;
       }, false);
       document.addEventListener('cookieconsent_marketing', function(event) {
           this.cookieConsentStatus = true;
       }, false);

      // iab tcf2
      Mirando.gdprParser.iabTcf2Consent = null;

      if (typeof __tcfapi === 'function') {
        __tcfapi('getTCData', 2, (tcData, success) => {

          if(success) {
            Mirando.gdprParser.iabTcf2Consent = {
              'gdpr': Boolean(tcData.gdprApplies) ? 1 : 0,
              'gdpr_consent_given': Mirando.gdprParser.hasTcfConsentGiven(tcData)?'yes':'no',
              'gdpr_consent': tcData.tcString
            }
          } else {
            console.error('error while getting tcf data');
          }
        });
      }
    },
    parse: function () {
        var consentProviderFinderFunctions = {
            'IAB TCF 2.x' : this.findByIabTcf2Consent,
            'CookieFirst' : this.findByCookieFirst,
            'TCM' : this.findByTCM,
            'CCM' : this.findByCCM,
            'fad_cookieconsent' : this.findByFAD,
            'CookieBot' : this.findByCookieBot,
            'Consentmanager' : this.findByConsentmanager,
            'Klaro' : this.findByKlaro,
            'asm' : this.findByAsm,
            'Cookieconsent' : this.findByCookieconsent,
            'Borlabs' : this.findByBorlabs
        };

        for (var consentProvider in consentProviderFinderFunctions) {
            var consentProviderFinderFunction = consentProviderFinderFunctions[consentProvider];
            var result = consentProviderFinderFunction();

            if (result !== null) {
                if (!('mirandoGdprInfoSent' in window)) {
                    console.info('%c[Mirando]', 'color: #33a8e0; padding: 3px 2px; font-style: italic', 'GPDR info:', consentProvider, result);
                    window.mirandoGdprInfoSent = true;
                }

                return result;
            }
        }

        let defaultGdprInfo = {
            'gdpr': 1,
            'gdpr_consent_given': 'no',
            'gdpr_consent': ''
        };

        if (!('mirandoGdprInfoSent' in window)) {
            console.info('%c[Mirando]', 'color: #33a8e0; padding: 3px 2px; font-style: italic', 'GPDR info:' ,'No gdpr consent provider found', defaultGdprInfo);
            window.mirandoGdprInfoSent = true;
        }

        return defaultGdprInfo;
    },

    getCookieValueByName : function(name) {
        let match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
        return match ? match[2] : "";
    },

    findByCookieFirst: function() {
        if ('CookieFirst' in window) {
            return {
                'gdpr': 1,
                'gdpr_consent_given': (window.CookieFirst.hasConsented && window.CookieFirst.consent.advertising ? 'yes' : 'no'),
                'gdpr_consent': ''
            }
        }

        return null;
    },

    findByCCM: function() {
        if ('CCM' in window && 'consent') {
            return {
                'gdpr': 1,
                'gdpr_consent_given': 'consent' in window.CCM ? (window.CCM.consent ? 'yes' : 'no') : 'unsure',
                'gdpr_consent': ''
            }
        }

        return null;
    },

    findByTCM: function() {
        let tcmString = localStorage.getItem("tcm");
        if (tcmString) {
            let tcm = JSON.parse(tcmString);
            return {
                'gdpr': 1,
                'gdpr_consent_given': 'mirando' in tcm ? (tcm.mirando ? 'yes' : 'no') : 'unsure',
                'gdpr_consent': ''
            }
        }

        return null;
    },

    findByFAD: function() {
        let fadString = decodeURIComponent(Mirando.gdprParser.getCookieValueByName('fad_cookieconsent'));
        if (fadString) {
            let fad = JSON.parse(fadString);
            return {
                'gdpr': 1,
                'gdpr_consent_given': 'other' in fad ? (fad.other ? 'yes' : 'no') : 'unsure',
                'gdpr_consent': ''
            }
        }

        return null;
    },

    findByCookieBot: function() {
        if ('Cookiebot' in window) {
            return {
                'gdpr': 1,
                'gdpr_consent_given': 'consent' in window.Cookiebot && 'marketing' in window.Cookiebot.consent ? (window.Cookiebot.consent.marketing ? 'yes' : 'no') : 'unsure',
                'gdpr_consent': 'IABConsentString' in window.Cookiebot ? window.Cookiebot.IABConsentString : ''
            }
        }

        return null;
    },

    findByConsentmanager: function() {
        if (typeof __cmp === 'function') {
            var consent = __cmp('consentStatus');

            return {
                'gdpr': consent.gdprApplies ? 1 : 0,
                'gdpr_consent_given': consent.consentExists && consent.userChoiceExists ? 'yes' : 'no',
                'gdpr_consent': consent.consentData
            };
        }

        return null;
    },

    findByKlaro: function() {
        if ('klaro' in window) {
            let consents = window.klaro.getManager().consents;
            return {
                'gdpr': 1,
                'gdpr_consent_given': 'mirando' in consents ? (consents.mirando ? 'yes' : 'no') : 'unsure',
                'gdpr_consent': ''
            }
        }

        return null;
    },

    findByAsm: function() {
        if ('asm_gdpr' in window) {
            return {
                'gdpr': window.asm_gdpr ? 1 : 0,
                'gdpr_consent_given': window.asm_gdpr_feedback === 'false' ? 'no' : 'unsure',
                'gdpr_consent': window.asm_gdpr_consent
            }
        }

        return null;
    },

    findByCookieconsent: function() {
        if (Mirando.gdprParser.cookieConsentStatus !== null) {
            return {
                'gdpr': 1,
                'gdpr_consent_given': Mirando.gdprParser.cookieConsentStatus ? 'yes' : 'no',
                'gdpr_consent': ''
            }
        }

        return null;
    },

    findByIabTcf2Consent: function() {
        if (Mirando.gdprParser.iabTcf2Consent !== null) {
            return Mirando.gdprParser.iabTcf2Consent;
        }

        return null;
    },

    findByBorlabs: function() {
        if ('BorlabsCookie' in window) {
            return {
                'gdpr': 1,
                'gdpr_consent_given': window.BorlabsCookie.checkCookieGroupConsent('marketing') ? 'yes' : 'no',
                'gdpr_consent': ''
            }
        }

        return null;
    },
};

Mirando.adLoader = function () {

    var adCounter = 0; // ads loaded by script
    var dynamicAdCounter = 1000; //ads loaded by showAd function and not by script
    var adPlaceId = null;
    var alreadyAsyncLoaded = false;
    var alreadySyncLoaded = false;
    var syncWarningSend = false;
    var adplaceDictionary = []; //dictionary adCounter => adplaceId
    var doneAdplaces = [];

    this.nextAdCounter = function () {
        adCounter++;
        return adCounter;
    };

    this.nextDynamicAdCounter = function () {
        dynamicAdCounter++;
        return dynamicAdCounter;
    };

    this.getAdplaceByAdCounter = function (_adCounter) {
        if (_adCounter in adplaceDictionary)
            return adplaceDictionary[_adCounter];
        return null;
    };

    this.getTopFrame = function () {
        var frame = window;
        try {
            while (frame.parent.document !== frame.document) frame = frame.parent;
        } catch (e) {
        }
        return frame;
    };

    /**
     * @param {int} adplaceId
     */
    this.registerDoneAdplace = function (adplaceId) {
        if (doneAdplaces.indexOf(adplaceId) < 0) {
            doneAdplaces.push(adplaceId);
        }
    };

    /**
     * is admaterial already deliverd on this adplace
     * @param {int} adplaceId
     * @return {boolean}
     */
    this.isAdplaceDone = function (adplaceId) {
        return doneAdplaces.indexOf(adplaceId) >= 0;
    };

    /**
     * force delivery in top iframe if adplace is layer
     * @param adPlaceId
     * @param mirandoQueryStringParser
     * @returns {boolean}
     */
    this.iframeBreaker = function (adPlaceId, mirandoQueryStringParser) {
        var that = this;

        var adPlaceTypeId = mirandoQueryStringParser.get('at');

        if (adPlaceTypeId == 4 || adPlaceId == 17589662 || adPlaceId == 13662560
            || adPlaceId == 9544322 || adPlaceId == 9413719) {
            var topFrame = that.getTopFrame();
            if (topFrame != null && topFrame != window) {
                var scriptElem = topFrame.document.createElement('script');
                scriptElem.src = mirandoQueryStringParser.getLastMirandoScriptInserted().src;
                topFrame.document.body.appendChild(scriptElem);
                return true;
            }
        }

        return false;
    };

    /**
     * display an ad in place executed by script
     */
    this.showAdByScript = function (adCounter) {
        var mirandoQueryStringParser = new Mirando.QueryStringParser(),
            res = mirandoQueryStringParser.init(adCounter - 1);
        if (!res) {
            return; //current script tag could not be found; should not happen and must be fixed
        }

        var self = this,
            lastMirandoScriptInserted = mirandoQueryStringParser.getScript(),
            adPlaceId = mirandoQueryStringParser.get('a'),
            adPlaceTypeId = mirandoQueryStringParser.get('at'),
            queryString = mirandoQueryStringParser.toString(),
            isAsync = queryString.indexOf('&as=1') >= 0,
            excludeMaterialTypes = mirandoQueryStringParser.get('excludeMaterialTypes'),
            callback = mirandoQueryStringParser.get('cb'),
            alternativePlacer = mirandoQueryStringParser.get('placer'),
            otherQueryParameters = mirandoQueryStringParser.getAllParams(['a', 'at', 'as', 'excludeMaterialTypes', 'placer', 'cb']);


        //prevent double floor ad loading
        if ('mirandoFloorAdDelivered' in window && window.mirandoFloorAdDelivered && adPlaceTypeId == 4) {
            return;
        }
        if (adPlaceTypeId == 4) {
            window.mirandoFloorAdDelivered = true;
        }

        if (adPlaceId) {
            adPlaceId = parseInt(adPlaceId);
            if (self.iframeBreaker(adPlaceId, mirandoQueryStringParser)) {
                return;
            }
            self.renderAd(adCounter, lastMirandoScriptInserted, adPlaceId, adPlaceTypeId, isAsync, excludeMaterialTypes, callback, alternativePlacer, false, otherQueryParameters);

            return adPlaceId;
        } else {
            Mirando.log.out('unable to obtain adPlaceId from queryString');

            return null;
        }
    };

    /**
     * display an ad created dynamically here by javascript
     * ad is loaded async
     * @param {int} adPlaceId
     * @param {int} adPlaceTypeId
     * @param {string} excludeMaterialTypes
     * @param {string} callback
     * @param {boolean} waitForDocumentReady
     */
    this.showAd = function (adPlaceId, adPlaceTypeId, excludeMaterialTypes, callback, alternativePlacer, waitForDocumentReady, otherQueryParameters) {
        var dynAdSpan = document.createElement("span"),
            self = this,
            adCounter = self.nextDynamicAdCounter();

        dynAdSpan.id = 'dyn-mir-ad-' + adCounter;
        dynAdSpan.style.display = 'none';
        document.body.appendChild(dynAdSpan);

        if (adPlaceTypeId == 100 && alreadySyncLoaded) {
            //speacial case for sync loadings; multi tag must wait for document ready
            console.warn('Bitte nur noch asynchrone Mirando Tags verwenden');
            function showAdWaitForDocumentReady()
            {
                if (document.readyState !== 'complete') {
                    setTimeout(function () {
                        showAdWaitForDocumentReady();
                    }, 300);
                } else {
                    self.renderAd(adCounter, dynAdSpan, adPlaceId, adPlaceTypeId, true, excludeMaterialTypes, callback, alternativePlacer, waitForDocumentReady, otherQueryParameters);
                }
            }

            showAdWaitForDocumentReady();
            return;
        }

        self.renderAd(adCounter, dynAdSpan, adPlaceId, adPlaceTypeId, true, excludeMaterialTypes, callback, alternativePlacer, waitForDocumentReady, otherQueryParameters);
    };

    /**
     * render repository request and execute or write request result
     */
    this.renderAd = function (adCounter, adTagElement, adPlaceId, adPlaceTypeId, isAsync, excludeMaterialTypes, callback, alternativePlacer, waitForDocumentReady, otherQueryParameters) {
        var that = this;

        var impressionId = new Mirando.ImpressionIdFactory().getOrCreate();

        if (!impressionId) {
            document.write("Auslieferung von Werbung im iFrame aus Sicherheitsgründen nicht möglich.");
            return;
        }

        if (that.isBlockedByLimitDisplayParams()) {
            return;
        }

        that.registerDoneAdplace(adPlaceId);

        var webQueryParams = new Mirando.QueryStringParser().parseUrl(document.location.href);

        var queryString = 'a=' + adPlaceId;
        if (isAsync) {
            queryString += '&as=1';
        }
        if (adPlaceTypeId) {
            queryString += '&at=' + adPlaceTypeId;
        }

        if (isAsync) {
            alreadyAsyncLoaded = true;
        } else if (alreadyAsyncLoaded && document.readyState !== 'complete') {
            if (!syncWarningSend) {
                that.showSyncWarning();
            }
            return;
        }

        if (!isAsync) {
            alreadySyncLoaded = true;
        }

        var instanceId = Mirando.instanceRegistry.getNextInstanceIdFor(adPlaceId);

        var mid = this.getMid();

        if (excludeMaterialTypes) {
            queryString = queryString.replace('excludeMaterialTypes=' + excludeMaterialTypes, '');
            queryString += "&excludeMaterialTypes=" + excludeMaterialTypes.replace(/,/g, ';');
        }

        if (mid) {
            queryString += "&mid=" + mid;
        }

        queryString += mirandoAsyncLoader.getAdditionalQueryParameters();

        //append gdpr data
        var gdprInfo = Mirando.gdprParser.parse();
        queryString += '&gdpr=' + gdprInfo['gdpr'] + '&gdpr_consent_given=' + gdprInfo['gdpr_consent_given'] + '&gdpr_consent=' + gdprInfo['gdpr_consent'];

        if ('miradmid' in webQueryParams) {
            queryString += '&admid=' + webQueryParams['miradmid'];
        }
        if ('includeCampaigns' in webQueryParams) {
            queryString += '&includeCampaigns=' + webQueryParams['includeCampaigns'].replace(',', ';');
        }

        if (otherQueryParameters) {
            for (var otherQueryParameterName in otherQueryParameters) {
                var param = otherQueryParameters[otherQueryParameterName];
                if (typeof param === 'string') {
                    queryString += "&" + otherQueryParameterName + "=" + param;
                }
            }
        }

        //add script id should be at the end of the script
        var scriptId = "__mirget" + adCounter;
        if (isAsync && waitForDocumentReady) {
            mirandoAsyncLoader.markScriptIdForDocumentReady(scriptId);
        }

        adplaceDictionary[adCounter] = adPlaceId;
        queryString = (queryString ? queryString + "&" : "") + "sid=" + scriptId;

        var request = new Mirando.AdRequest(adPlaceId, impressionId.toString(), instanceId, queryString, scriptId, adCounter, isAsync, callback);

        var renderedRequest = request.render();

        if (isAsync) {
            //async request
            that.insertAdRequestAsync(renderedRequest, adTagElement, scriptId, adCounter, alternativePlacer, callback)
        }
        else {
            //sync request
            document.write(renderedRequest);
            if (callback && eval("typeof " + callback + "== 'function'")) {
                eval(callback + '();');
            }
        }

        return adPlaceId;
    };

    this.insertAdRequestAsync = function (renderedRequest, adTagElement, scriptId, scriptIndex, alternativePlacer, callback) {
        var self = this,
            placer = alternativePlacer;
        var asyncRequestFunc = function () {
            mirandoAsyncLoader.setRepositoryRequestSent(true);

            if (callback) {
                mirandoAsyncLoader.setCallbackForScriptId(scriptId, callback);
            }

            if (!placer) {
                //normal placement before mirando.js script tag
                placer = adTagElement;
                mirandoAsyncLoader.insertBeforeHtml(placer, renderedRequest);
            }
            else {
                //special placement before placer tag (2in1,...)
                if (typeof placer == 'string') {
                    placer = document.getElementById(placer);
                }

                var scriptIndex = parseInt(scriptId.replace('__mirget', ''));
                if (!isNaN(scriptIndex)) {
                    //placer force
                    mirandoAsyncLoader.setCurrentPlacer(scriptIndex, placer.id);
                }

                mirandoAsyncLoader.insertBeforeHtml(placer, renderedRequest);
            }

            var scriptInserted = document.getElementById(scriptId);

            function finishScriptLoading() {
                mirandoAsyncLoader.setRepositoryRequestSent(false);
                if (!mirandoAsyncLoader.getDeliveredAdmaterialIdsForScriptIndex(scriptIndex).length) {
                    if (callback && eval("typeof " + callback + "== 'function'")) {
                        eval(callback + '(false);');
                    }
                }
            }

            scriptInserted.onload = function () {
                finishScriptLoading();
            };
            scriptInserted.onerror = function () {
                finishScriptLoading();
            };
        };

        self.renderRepositoryRequestAsyncWithFunction(asyncRequestFunc);
    };

    /**
     * for repository requests done one by one
     * repository script request is done by renderRepositoryRequestFunc
     *
     * @param renderRepositoryRequestFunc
     */
    this.renderRepositoryRequestAsyncWithFunction = function (renderRepositoryRequestFunc) {
        //make render request 1 after 1
        function renderRequestDelayed(asyncRequestFunc) {
            if (mirandoAsyncLoader.getRepositoryRequestSent()) {
                setTimeout(function () {
                    renderRequestDelayed(asyncRequestFunc);
                }, 1);
            }
            else {
                asyncRequestFunc();
            }
        }

        renderRequestDelayed(renderRepositoryRequestFunc);
    };

    this.showSyncWarning = function () {
        console.error("Keine gemischte Auslieferung auf asynchronen und synchronen Tags möglich. Bitte bauen Sie nur asynchrone Mirando Tags ein");

        /*var warningDiv = document.createElement("div");
        warningDiv.style.position = 'fixed';
        warningDiv.style.left = '30px';
        warningDiv.style.bottom = '30px';
        warningDiv.style.borderWidth = "2px";
        warningDiv.style.padding = "6px";
        warningDiv.style.borderColor = "#dd0000";
        warningDiv.style.width = "200px";
        warningDiv.style.backgroundColor = "#ffffff";
        warningDiv.innerHTML = "Mirando Warnung:<br/>Keine gemischte Auslieferung auf asynchronen und synchronen Tags möglich";
        warningDiv.style.borderStyle = "solid";
        warningDiv.style.color = "#dd0000";

        syncWarningSend = true;
        document.body.appendChild(warningDiv);*/
    };

    this.isBlockedByLimitDisplayParams = function () {
        try {
            //client display restrictions
            if (typeof mirLimitDisplayWidthMin !== 'undefined') {
                if (window.screen.availWidth && window.screen.availWidth < mirLimitDisplayWidthMin) {
                    console.log('admaterial delivery blocked because of mirLimitDisplayWidthMin');
                    return true;
                }
            }
            if (typeof mirLimitDisplayHeightMin !== 'undefined') {
                if (window.screen.availHeight && window.screen.availHeight < mirLimitDisplayHeightMin) {
                    console.log('admaterial delivery blocked because of mirLimitDisplayHeightMin');
                    return true;
                }
            }
            //browser window size restrictions
            if (typeof mirLimitBrowserWindowWidthMin !== 'undefined') {
                var bwidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
                if (bwidth && bwidth < mirLimitBrowserWindowWidthMin) {
                    console.log('admaterial delivery blocked because of mirLimitBrowserWindowWidthMin');
                    return true;
                }
            }
            if (typeof mirLimitBrowserWindowHeightMin !== 'undefined') {
                var bheight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
                if (bheight && bheight < mirLimitBrowserWindowHeightMin) {
                    console.log('admaterial delivery blocked because of mirLimitBrowserWindowHeightMin');
                    return true;
                }
            }
        }
        catch (e) {
            console.log(e);
        }

        return false;
    };

    this.getMid = function () {
        try {
            var regex = new RegExp('(?:^|;)\\s?mid=(.*?)(?:;|$)', 'i');
            var match = document.cookie.match(regex);
            if (match) {
                var mid = unescape(match[1]);
                if (mid) {
                    return mid;
                }
            }

            if (window.localStorage && window.localStorage.getItem) {

                return localStorage.getItem("mid");

            }
        }
        catch (e) {
        }
    };

    this.viewportCheck = function (_impressionId, _adPlaceId) {
        var currentScript = document.currentScript || (function () {
                var scripts = document.getElementsByTagName('script');
                return scripts[scripts.length - 1];
            })();

        var testxyuid = Math.floor((Math.random() * 100000) + 1);

        var trackdiv = document.createElement("div");
        trackdiv.setAttribute('id', 'testxy' + testxyuid);
        trackdiv.setAttribute('height', '1px');
        trackdiv.setAttribute('width', '1px');
        currentScript.parentNode.appendChild(trackdiv);

        var elem = trackdiv;

        var vp_w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        var vp_h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
        var url = "//get.mirando.de/download/mirando/publisher-quality/track.php?";
        url += "vp=" + vp_w + "x" + vp_h;
        var elemrect = elem.getBoundingClientRect();

        elem.style.display = "none";
        url += "&pos=" + Math.round(elemrect.left) + "x" + Math.round(elemrect.top);
        url += "&impid=" + _impressionId;
        url += "&apid=" + _adPlaceId;
        var iframe = 0;
        var uri = self.location.href;
        var ref_uri = document.referrer;
        if (top.location.href != self.location.href) {
            iframe = 1;
            ref_uri = top.location.href;
        }
        url += "&iframe=" + iframe;
        url += "&uri=" + escape(uri);
        if (ref_uri)
            url += "&refuri=" + escape(ref_uri);

        url += "&client=" + navigator.userAgent + ";" + navigator.appName + ";" + navigator.platform;
        url += "&pid=" + mirPageViewID;


        //calculate adplace count

        var adplace_count = 0;
        var all = document.getElementsByTagName("script");
        for (var i = 0; i < all.length; i++) {
            elem = all[i];
            if (elem.src && elem.src.indexOf("mirando.js#a=" + _adPlaceId) >= 0 && elem.src.indexOf("role=ss") < 0) {
                adplace_count++;
            }
        }
        url += "&ac=" + adplace_count;

        var trackpix = document.createElement("img");
        trackpix.setAttribute('src', url);
        trackpix.setAttribute('height', '1px');
        trackpix.setAttribute('width', '1px');
        trackpix.style.position = 'absolute';
        trackpix.style.left = '-1000px';
        trackpix.style.top = '-1000px';
        document.body.appendChild(trackpix);
        return url;
    };

    try {
        if (typeof adPlaceId !== 'undefined' && typeof impressionId !== 'undefined') {
            //this.viewportCheck(impressionId.toString(),adPlaceId);
        }
    }
    catch (e) {
        console.log(e);
    }
};

/**
 * component for measuring special actions like time spent, scroll depth
 */
Mirando.measuringHandler = function () {

    //dictionary type => measuring url
    var measurings = [];

    this.init = function () {
        var self = this;
        var w = window;

        //console.log('register unload');

        w.addEventListener ? w.addEventListener("beforeunload", function () {
            return self.unload();
        }, !1)
            : w.attachEvent && w.attachEvent("onbeforeunload", function () {
            return self.unload();
        });

        w.addEventListener ? w.addEventListener("scroll", function () {
            return self.adjustScrollDepth();
        }, !1)
            : w.attachEvent && w.attachEvent("onscroll", function () {
            return self.adjustScrollDepth();
        });

    };

    /**
     * register measuring process; must be called by admaterial delivered
     *
     * @param type
     * @param url
     */
    this.register = function (type, url) {
        var self = this;

        var measuring = [];
        measuring['type'] = type;
        measuring['url'] = url;
        measuring['ts'] = new Date().getTime();
        measuring['sd'] = self.currentScrollDepth();

        measurings.push(measuring);
    };

    this.unload = function () {
        var self = this;
        var cMeasurings = self.shuffledMeasurings();

        for (var i = 0; i < cMeasurings.length; i++) {
            var measuring = cMeasurings[i];
            var image = document.createElement("img");
            var url = measuring['url'] + '?meas=';
            switch (measuring['type']) {
                case 'TIMESPENT':
                    url += self.getTimeSpent(measuring['ts']);
                    break;
                case 'SCROLLDEPTH':
                    if (null === measuring['sd']) {
                        continue;
                    }
                    url += measuring['sd'];
                    break;
            }

            image.src = url;
            document.body.appendChild(image);
        }
    };

    this.getTimeSpent = function (initialTimestamp) {
        var currentTimeSpent = (new Date().getTime()-initialTimestamp);
        // Limit Time spent on page to 5 minutes
        var spentTimeLimit = 1000*60*5;
        return ((currentTimeSpent>=spentTimeLimit) ? spentTimeLimit : currentTimeSpent);
    };

    this.currentScrollDepth = function (initialTimestamp) {
        //return document.documentElement.scrollTop || document.body.scrollTop;
        function getDocHeight() {
            var D = document;
            return Math.max(
                D.body.scrollHeight, D.documentElement.scrollHeight,
                D.body.offsetHeight, D.documentElement.offsetHeight,
                D.body.clientHeight, D.documentElement.clientHeight
            )
        }

        var winheight = window.innerHeight || (document.documentElement || document.body).clientHeight;
        var docheight = getDocHeight();
        var scrollTop = window.pageYOffset || (document.documentElement || document.body.parentNode || document.body).scrollTop;
        var pctScrolled = Math.round((winheight + scrollTop) * 100 / docheight);

        if (isNaN(pctScrolled) || pctScrolled < 0 || pctScrolled > 100) {
            return null;
        }

        return pctScrolled;
    };

    this.adjustScrollDepth = function (initialTimestamp) {
        var self = this;
        var sd = self.currentScrollDepth();

        for (var i = 0; i < measurings.length; i++) {
            if (sd > measurings[i]['sd']) {
                measurings[i]['sd'] = sd;
            }
        }
    };

    this.shuffledMeasurings = function () {
        a = measurings;

        var j, x, i;
        for (i = a.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            x = a[i];
            a[i] = a[j];
            a[j] = x;
        }
        return a;
    }
};

/**
 * component for tracking os by views or clicks
 */
Mirando.osTrackedUrls = [];

Mirando.osTrackingHandler = {

    track: function (osTrackingUrl) {
        if (Mirando.osTrackedUrls.includes(osTrackingUrl)) {
          //return;
        }

        var image = document.createElement('img');

        Mirando.osTrackedUrls.push(osTrackingUrl);
        var url = osTrackingUrl + '?meas=1&subtype=' + this.getOs();

        image.src = url;
        document.body.appendChild(image);
    },

    handleClickUrlAndTrackOs: function(clickUrl, osTrackingUrl) {
        Mirando.osTrackingHandler.track('osTrackingUrl');
        var clickTag = document.createElement('a');
        clickTag.href = clickUrl;
        clickTag.target = '_blank';
        document.body.appendChild(clickTag);
        clickTag.click();
    },

    getOs: function () {
        if (navigator.userAgent.match(/Android/i)) {
            return 'Android';
        }

        if (navigator.userAgent.match(/BlackBerry/i)) {
            return 'BlackBerry';
        }

        if (navigator.userAgent.match(/iPhone/i)) {
            return 'iPhone';
        }

        if (navigator.userAgent.match(/iPad/i)) {
            return 'iPad';
        }

        if (navigator.userAgent.match(/iPod/i)) {
            return 'iPod';
        }

        if (navigator.appVersion.indexOf('Win') >= 0) {
            return 'Windows';
        }
        if (navigator.appVersion.indexOf('Mac') >= 0) {
            return 'MacOS';
        }

        if (navigator.appVersion.indexOf('X11') >= 0) {
            return 'Unix';
        }

        if (navigator.appVersion.indexOf('Linux') >= 0) {
            return 'Linux';
        }
    }
};

if (!mirPageViewID) {
    var mirPageViewID = Math.random().toString(36).slice(-12) + "-" + Math.random().toString(36).slice(-12) + "-" + Math.random().toString(36).slice(-12) + "-" + Math.random().toString(36).slice(-12);
}

if (!(typeof window.mirandoAdLoaderInited !== 'undefined' || window.mirandoAdLoaderInited)) {
    window.mirandoAdLoaderInited = true;
    var mirandoAsyncLoader = new Mirando.AsyncLoader();
    var mirandoAdLoader = new Mirando.adLoader();
    var mirandoMeasuringHandler = new Mirando.measuringHandler();
    mirandoMeasuringHandler.init();
    Mirando.gdprParser.init();
}

Mirando.nativeAnalyzer.start();

var nextAdCounter = mirandoAdLoader.nextAdCounter();
var adplaceId = mirandoAdLoader.showAdByScript(nextAdCounter);

