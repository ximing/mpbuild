var stringifyPrimitive=function(e){switch(typeof e){case"string":return e;case"boolean":return e?"true":"false";case"number":return isFinite(e)?e:"";default:return""}};module.exports=function(n,t,r,e){return t=t||"&",r=r||"=","object"==typeof(n=null===n?void 0:n)?Object.keys(n).map(function(e){var i=encodeURIComponent(stringifyPrimitive(e))+r;return Array.isArray(n[e])?n[e].map(function(e){return i+encodeURIComponent(stringifyPrimitive(e))}).join(t):i+encodeURIComponent(stringifyPrimitive(n[e]))}).join(t):e?encodeURIComponent(stringifyPrimitive(e))+r+encodeURIComponent(stringifyPrimitive(n)):""};