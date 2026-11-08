/* Self-contained SVG icon set used by the ILS React screens. No external CDN. */
(function(global){
  'use strict';
  const R = global.ILSReactCompat;
  const paths = {
    ArrowLeft: [['path',{d:'m12 19-7-7 7-7'}],['path',{d:'M19 12H5'}]],
    ArrowRight: [['path',{d:'M5 12h14'}],['path',{d:'m12 5 7 7-7 7'}]],
    ChevronRight: [['path',{d:'m9 18 6-6-6-6'}]],
    ChevronDown: [['path',{d:'m6 9 6 6 6-6'}]],
    X: [['path',{d:'M18 6 6 18'}],['path',{d:'m6 6 12 12'}]],
    Plus: [['path',{d:'M12 5v14'}],['path',{d:'M5 12h14'}]],
    PlusCircle: [['circle',{cx:12,cy:12,r:10}],['path',{d:'M12 8v8'}],['path',{d:'M8 12h8'}]],
    Trash2: [['path',{d:'M3 6h18'}],['path',{d:'M8 6V4h8v2'}],['path',{d:'M19 6l-1 14H6L5 6'}],['path',{d:'M10 10v7'}],['path',{d:'M14 10v7'}]],
    Search: [['circle',{cx:11,cy:11,r:7}],['path',{d:'m16 16 5 5'}]],
    Download: [['path',{d:'M12 3v12'}],['path',{d:'m7 10 5 5 5-5'}],['path',{d:'M4 17v4h16v-4'}]],
    RotateCcw: [['path',{d:'M3 11a9 9 0 1 1 3 7'}],['path',{d:'M3 3v8h8'}]],
    Settings2: [['path',{d:'M4 7h16 M4 17h16'}],['circle',{cx:9,cy:7,r:2}],['circle',{cx:15,cy:17,r:2}]],
    FileSearch: [['path',{d:'M14 2H6v20h12V8z'}],['path',{d:'M14 2v6h6'}],['circle',{cx:10,cy:14,r:3}],['path',{d:'m12 16 3 3'}]],
    FileText: [['path',{d:'M14 2H6v20h12V8z'}],['path',{d:'M14 2v6h6'}],['path',{d:'M9 13h6M9 17h6'}]],
    Briefcase: [['rect',{x:3,y:7,width:18,height:14,rx:2}],['path',{d:'M8 7V4h8v3 M3 13h18'}]],
    Inbox: [['path',{d:'M4 4h16l2 11v5H2v-5z'}],['path',{d:'M2 15h6l2 3h4l2-3h6'}]],
    Command: [['path',{d:'M9 7V5a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v14a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z'}]],
    Wand2: [['path',{d:'m4 20 12-12'}],['path',{d:'m13 7 4 4'}],['path',{d:'M17 2v3 M21 6h-3 M5 4l1 2 M3 9l2 1'}]],
    CircleAlert: [['circle',{cx:12,cy:12,r:10}],['path',{d:'M12 7v6'}],['path',{d:'M12 17h.01'}]],
    Truck: [['path',{d:'M2 5h12v12H2z M14 9h4l4 4v4h-8'}],['circle',{cx:7,cy:18,r:2}],['circle',{cx:18,cy:18,r:2}]],
    Stethoscope: [['path',{d:'M6 3v8a6 6 0 0 0 12 0V3'}],['circle',{cx:19,cy:15,r:2}],['path',{d:'M18 17v1a5 5 0 0 1-10 0v-1'}]],
  };
  function icon(name) {
    return function Icon(props) {
      const {size=20,strokeWidth=2,color='currentColor',className='',...extra} = props || {};
      const children = (paths[name] || [['circle',{cx:12,cy:12,r:9}],['path',{d:'M12 9v6'}]]).map(([tag,attributes],i) => R.createElement(tag,Object.assign({key:i},attributes)));
      return R.createElement('svg',Object.assign({width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:color,strokeWidth,strokeLinecap:'round',strokeLinejoin:'round',className,'aria-hidden':'true'},extra),...children);
    };
  }
  global.ILSLucideLite = Object.fromEntries(Object.keys(paths).map(name=>[name,icon(name)]));
})(window);
