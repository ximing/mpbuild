var forEach=require("../foreach/index.js"),availableTypedArrays=require("../available-typed-arrays/index.js"),callBound=require("../call-bind/callBound.js"),$toString=callBound("Object.prototype.toString"),hasSymbols=require("../has-symbols/index.js")(),hasToStringTag=hasSymbols&&"symbol"==typeof Symbol.toStringTag,typedArrays=availableTypedArrays(),$indexOf=callBound("Array.prototype.indexOf",!0)||function(r,t){for(var e=0;e<r.length;e+=1)if(r[e]===t)return e;return-1},$slice=callBound("String.prototype.slice"),toStrTags={},gOPD=require("../es-abstract/helpers/getOwnPropertyDescriptor.js"),getPrototypeOf=Object.getPrototypeOf;hasToStringTag&&gOPD&&getPrototypeOf&&forEach(typedArrays,function(r){var t=new global[r];if(!(Symbol.toStringTag in t))throw new EvalError("this engine has support for Symbol.toStringTag, but "+r+" does not have the property! Please report this.");var e=getPrototypeOf(t),t=gOPD(e,Symbol.toStringTag);t||(e=getPrototypeOf(e),t=gOPD(e,Symbol.toStringTag)),toStrTags[r]=t.get});var tryTypedArrays=function(e){var o=!1;return forEach(toStrTags,function(r,t){if(!o)try{o=r.call(e)===t}catch(r){}}),o};module.exports=function(r){if(!r||"object"!=typeof r)return!1;if(hasToStringTag)return!!gOPD&&tryTypedArrays(r);r=$slice($toString(r),8,-1);return-1<$indexOf(typedArrays,r)};