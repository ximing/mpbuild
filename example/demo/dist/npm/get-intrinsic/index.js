var undefined,$SyntaxError=SyntaxError,$Function=Function,$TypeError=TypeError,getEvalledConstructor=function(r){try{return $Function('"use strict"; return ('+r+").constructor;")()}catch(r){}},$gOPD=Object.getOwnPropertyDescriptor;if($gOPD)try{$gOPD({},"")}catch(e){$gOPD=null}var throwTypeError=function(){throw new $TypeError},ThrowTypeError=$gOPD?function(){try{return throwTypeError}catch(r){try{return $gOPD(arguments,"callee").get}catch(r){return throwTypeError}}}():throwTypeError,hasSymbols=require("../has-symbols/index.js")(),getProto=Object.getPrototypeOf||function(r){return r.__proto__},needsEval={},TypedArray="undefined"==typeof Uint8Array?undefined:getProto(Uint8Array),INTRINSICS={"%AggregateError%":"undefined"==typeof AggregateError?undefined:AggregateError,"%Array%":Array,"%ArrayBuffer%":"undefined"==typeof ArrayBuffer?undefined:ArrayBuffer,"%ArrayIteratorPrototype%":hasSymbols?getProto([][Symbol.iterator]()):undefined,"%AsyncFromSyncIteratorPrototype%":undefined,"%AsyncFunction%":needsEval,"%AsyncGenerator%":needsEval,"%AsyncGeneratorFunction%":needsEval,"%AsyncIteratorPrototype%":needsEval,"%Atomics%":"undefined"==typeof Atomics?undefined:Atomics,"%BigInt%":"undefined"==typeof BigInt?undefined:BigInt,"%Boolean%":Boolean,"%DataView%":"undefined"==typeof DataView?undefined:DataView,"%Date%":Date,"%decodeURI%":decodeURI,"%decodeURIComponent%":decodeURIComponent,"%encodeURI%":encodeURI,"%encodeURIComponent%":encodeURIComponent,"%Error%":Error,"%eval%":eval,"%EvalError%":EvalError,"%Float32Array%":"undefined"==typeof Float32Array?undefined:Float32Array,"%Float64Array%":"undefined"==typeof Float64Array?undefined:Float64Array,"%FinalizationRegistry%":"undefined"==typeof FinalizationRegistry?undefined:FinalizationRegistry,"%Function%":$Function,"%GeneratorFunction%":needsEval,"%Int8Array%":"undefined"==typeof Int8Array?undefined:Int8Array,"%Int16Array%":"undefined"==typeof Int16Array?undefined:Int16Array,"%Int32Array%":"undefined"==typeof Int32Array?undefined:Int32Array,"%isFinite%":isFinite,"%isNaN%":isNaN,"%IteratorPrototype%":hasSymbols?getProto(getProto([][Symbol.iterator]())):undefined,"%JSON%":"object"==typeof JSON?JSON:undefined,"%Map%":"undefined"==typeof Map?undefined:Map,"%MapIteratorPrototype%":"undefined"!=typeof Map&&hasSymbols?getProto((new Map)[Symbol.iterator]()):undefined,"%Math%":Math,"%Number%":Number,"%Object%":Object,"%parseFloat%":parseFloat,"%parseInt%":parseInt,"%Promise%":"undefined"==typeof Promise?undefined:Promise,"%Proxy%":"undefined"==typeof Proxy?undefined:Proxy,"%RangeError%":RangeError,"%ReferenceError%":ReferenceError,"%Reflect%":"undefined"==typeof Reflect?undefined:Reflect,"%RegExp%":RegExp,"%Set%":"undefined"==typeof Set?undefined:Set,"%SetIteratorPrototype%":"undefined"!=typeof Set&&hasSymbols?getProto((new Set)[Symbol.iterator]()):undefined,"%SharedArrayBuffer%":"undefined"==typeof SharedArrayBuffer?undefined:SharedArrayBuffer,"%String%":String,"%StringIteratorPrototype%":hasSymbols?getProto(""[Symbol.iterator]()):undefined,"%Symbol%":hasSymbols?Symbol:undefined,"%SyntaxError%":$SyntaxError,"%ThrowTypeError%":ThrowTypeError,"%TypedArray%":TypedArray,"%TypeError%":$TypeError,"%Uint8Array%":"undefined"==typeof Uint8Array?undefined:Uint8Array,"%Uint8ClampedArray%":"undefined"==typeof Uint8ClampedArray?undefined:Uint8ClampedArray,"%Uint16Array%":"undefined"==typeof Uint16Array?undefined:Uint16Array,"%Uint32Array%":"undefined"==typeof Uint32Array?undefined:Uint32Array,"%URIError%":URIError,"%WeakMap%":"undefined"==typeof WeakMap?undefined:WeakMap,"%WeakRef%":"undefined"==typeof WeakRef?undefined:WeakRef,"%WeakSet%":"undefined"==typeof WeakSet?undefined:WeakSet},doEval=function r(e){var t,o;return"%AsyncFunction%"===e?t=getEvalledConstructor("async function () {}"):"%GeneratorFunction%"===e?t=getEvalledConstructor("function* () {}"):"%AsyncGeneratorFunction%"===e?t=getEvalledConstructor("async function* () {}"):"%AsyncGenerator%"===e?(o=r("%AsyncGeneratorFunction%"))&&(t=o.prototype):"%AsyncIteratorPrototype%"!==e||(o=r("%AsyncGenerator%"))&&(t=getProto(o.prototype)),INTRINSICS[e]=t},LEGACY_ALIASES={"%ArrayBufferPrototype%":["ArrayBuffer","prototype"],"%ArrayPrototype%":["Array","prototype"],"%ArrayProto_entries%":["Array","prototype","entries"],"%ArrayProto_forEach%":["Array","prototype","forEach"],"%ArrayProto_keys%":["Array","prototype","keys"],"%ArrayProto_values%":["Array","prototype","values"],"%AsyncFunctionPrototype%":["AsyncFunction","prototype"],"%AsyncGenerator%":["AsyncGeneratorFunction","prototype"],"%AsyncGeneratorPrototype%":["AsyncGeneratorFunction","prototype","prototype"],"%BooleanPrototype%":["Boolean","prototype"],"%DataViewPrototype%":["DataView","prototype"],"%DatePrototype%":["Date","prototype"],"%ErrorPrototype%":["Error","prototype"],"%EvalErrorPrototype%":["EvalError","prototype"],"%Float32ArrayPrototype%":["Float32Array","prototype"],"%Float64ArrayPrototype%":["Float64Array","prototype"],"%FunctionPrototype%":["Function","prototype"],"%Generator%":["GeneratorFunction","prototype"],"%GeneratorPrototype%":["GeneratorFunction","prototype","prototype"],"%Int8ArrayPrototype%":["Int8Array","prototype"],"%Int16ArrayPrototype%":["Int16Array","prototype"],"%Int32ArrayPrototype%":["Int32Array","prototype"],"%JSONParse%":["JSON","parse"],"%JSONStringify%":["JSON","stringify"],"%MapPrototype%":["Map","prototype"],"%NumberPrototype%":["Number","prototype"],"%ObjectPrototype%":["Object","prototype"],"%ObjProto_toString%":["Object","prototype","toString"],"%ObjProto_valueOf%":["Object","prototype","valueOf"],"%PromisePrototype%":["Promise","prototype"],"%PromiseProto_then%":["Promise","prototype","then"],"%Promise_all%":["Promise","all"],"%Promise_reject%":["Promise","reject"],"%Promise_resolve%":["Promise","resolve"],"%RangeErrorPrototype%":["RangeError","prototype"],"%ReferenceErrorPrototype%":["ReferenceError","prototype"],"%RegExpPrototype%":["RegExp","prototype"],"%SetPrototype%":["Set","prototype"],"%SharedArrayBufferPrototype%":["SharedArrayBuffer","prototype"],"%StringPrototype%":["String","prototype"],"%SymbolPrototype%":["Symbol","prototype"],"%SyntaxErrorPrototype%":["SyntaxError","prototype"],"%TypedArrayPrototype%":["TypedArray","prototype"],"%TypeErrorPrototype%":["TypeError","prototype"],"%Uint8ArrayPrototype%":["Uint8Array","prototype"],"%Uint8ClampedArrayPrototype%":["Uint8ClampedArray","prototype"],"%Uint16ArrayPrototype%":["Uint16Array","prototype"],"%Uint32ArrayPrototype%":["Uint32Array","prototype"],"%URIErrorPrototype%":["URIError","prototype"],"%WeakMapPrototype%":["WeakMap","prototype"],"%WeakSetPrototype%":["WeakSet","prototype"]},bind=require("../function-bind/index.js"),hasOwn=require("../has/src/index.js"),$concat=bind.call(Function.call,Array.prototype.concat),$spliceApply=bind.call(Function.apply,Array.prototype.splice),$replace=bind.call(Function.call,String.prototype.replace),$strSlice=bind.call(Function.call,String.prototype.slice),rePropName=/[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g,reEscapeChar=/\\(\\)?/g,stringToPath=function(r){var e=$strSlice(r,0,1),t=$strSlice(r,-1);if("%"===e&&"%"!==t)throw new $SyntaxError("invalid intrinsic syntax, expected closing `%`");if("%"===t&&"%"!==e)throw new $SyntaxError("invalid intrinsic syntax, expected opening `%`");var n=[];return $replace(r,rePropName,function(r,e,t,o){n[n.length]=t?$replace(o,reEscapeChar,"$1"):e||r}),n},getBaseIntrinsic=function(r,e){var t,o=r;if(hasOwn(LEGACY_ALIASES,o)&&(o="%"+(t=LEGACY_ALIASES[o])[0]+"%"),hasOwn(INTRINSICS,o)){var n=INTRINSICS[o];if(void 0===(n=n===needsEval?doEval(o):n)&&!e)throw new $TypeError("intrinsic "+r+" exists, but is not available. Please file an issue!");return{alias:t,name:o,value:n}}throw new $SyntaxError("intrinsic "+r+" does not exist!")};module.exports=function(r,e){if("string"!=typeof r||0===r.length)throw new $TypeError("intrinsic name must be a non-empty string");if(1<arguments.length&&"boolean"!=typeof e)throw new $TypeError('"allowMissing" argument must be a boolean');var t,o=stringToPath(r),n=0<o.length?o[0]:"",a=getBaseIntrinsic("%"+n+"%",e),y=(a.name,a.value),i=!1,a=a.alias;a&&(n=a[0],$spliceApply(o,$concat([0,1],a)));for(var p=1,d=!0;p<o.length;p+=1){var f=o[p],s=$strSlice(f,0,1),u=$strSlice(f,-1);if(('"'===s||"'"===s||"`"===s||'"'===u||"'"===u||"`"===u)&&s!==u)throw new $SyntaxError("property names with quotes must have matching quotes");if("constructor"!==f&&d||(i=!0),hasOwn(INTRINSICS,t="%"+(n+="."+f)+"%"))y=INTRINSICS[t];else if(null!=y){if(!(f in y)){if(!e)throw new $TypeError("base intrinsic for "+r+" exists, but the property is not available.");return}y=$gOPD&&p+1>=o.length?(d=!!(u=$gOPD(y,f)))&&"get"in u&&!("originalValue"in u.get)?u.get:y[f]:(d=hasOwn(y,f),y[f]),d&&!i&&(INTRINSICS[t]=y)}}return y};