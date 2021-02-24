var isArgumentsObject=require("../../is-arguments/index.js"),isGeneratorFunction=require("../../is-generator-function/index.js"),whichTypedArray=require("../../which-typed-array/index.js"),isTypedArray=require("../../is-typed-array/index.js");function uncurryThis(r){return r.call.bind(r)}var bigIntValue,symbolValue,BigIntSupported="undefined"!=typeof BigInt,SymbolSupported="undefined"!=typeof Symbol,ObjectToString=uncurryThis(Object.prototype.toString),numberValue=uncurryThis(Number.prototype.valueOf),stringValue=uncurryThis(String.prototype.valueOf),booleanValue=uncurryThis(Boolean.prototype.valueOf);function checkBoxedPrimitive(r,e){if("object"!=typeof r)return!1;try{return e(r),!0}catch(r){return!1}}function isPromise(r){return"undefined"!=typeof Promise&&r instanceof Promise||null!==r&&"object"==typeof r&&"function"==typeof r.then&&"function"==typeof r.catch}function isArrayBufferView(r){return"undefined"!=typeof ArrayBuffer&&ArrayBuffer.isView?ArrayBuffer.isView(r):isTypedArray(r)||isDataView(r)}function isUint8Array(r){return"Uint8Array"===whichTypedArray(r)}function isUint8ClampedArray(r){return"Uint8ClampedArray"===whichTypedArray(r)}function isUint16Array(r){return"Uint16Array"===whichTypedArray(r)}function isUint32Array(r){return"Uint32Array"===whichTypedArray(r)}function isInt8Array(r){return"Int8Array"===whichTypedArray(r)}function isInt16Array(r){return"Int16Array"===whichTypedArray(r)}function isInt32Array(r){return"Int32Array"===whichTypedArray(r)}function isFloat32Array(r){return"Float32Array"===whichTypedArray(r)}function isFloat64Array(r){return"Float64Array"===whichTypedArray(r)}function isBigInt64Array(r){return"BigInt64Array"===whichTypedArray(r)}function isBigUint64Array(r){return"BigUint64Array"===whichTypedArray(r)}function isMapToString(r){return"[object Map]"===ObjectToString(r)}function isMap(r){return"undefined"!=typeof Map&&(isMapToString.working?isMapToString(r):r instanceof Map)}function isSetToString(r){return"[object Set]"===ObjectToString(r)}function isSet(r){return"undefined"!=typeof Set&&(isSetToString.working?isSetToString(r):r instanceof Set)}function isWeakMapToString(r){return"[object WeakMap]"===ObjectToString(r)}function isWeakMap(r){return"undefined"!=typeof WeakMap&&(isWeakMapToString.working?isWeakMapToString(r):r instanceof WeakMap)}function isWeakSetToString(r){return"[object WeakSet]"===ObjectToString(r)}function isWeakSet(r){return isWeakSetToString(r)}function isArrayBufferToString(r){return"[object ArrayBuffer]"===ObjectToString(r)}function isArrayBuffer(r){return"undefined"!=typeof ArrayBuffer&&(isArrayBufferToString.working?isArrayBufferToString(r):r instanceof ArrayBuffer)}function isDataViewToString(r){return"[object DataView]"===ObjectToString(r)}function isDataView(r){return"undefined"!=typeof DataView&&(isDataViewToString.working?isDataViewToString(r):r instanceof DataView)}function isSharedArrayBufferToString(r){return"[object SharedArrayBuffer]"===ObjectToString(r)}function isSharedArrayBuffer(r){return"undefined"!=typeof SharedArrayBuffer&&(isSharedArrayBufferToString.working?isSharedArrayBufferToString(r):r instanceof SharedArrayBuffer)}function isAsyncFunction(r){return"[object AsyncFunction]"===ObjectToString(r)}function isMapIterator(r){return"[object Map Iterator]"===ObjectToString(r)}function isSetIterator(r){return"[object Set Iterator]"===ObjectToString(r)}function isGeneratorObject(r){return"[object Generator]"===ObjectToString(r)}function isWebAssemblyCompiledModule(r){return"[object WebAssembly.Module]"===ObjectToString(r)}function isNumberObject(r){return checkBoxedPrimitive(r,numberValue)}function isStringObject(r){return checkBoxedPrimitive(r,stringValue)}function isBooleanObject(r){return checkBoxedPrimitive(r,booleanValue)}function isBigIntObject(r){return BigIntSupported&&checkBoxedPrimitive(r,bigIntValue)}function isSymbolObject(r){return SymbolSupported&&checkBoxedPrimitive(r,symbolValue)}function isBoxedPrimitive(r){return isNumberObject(r)||isStringObject(r)||isBooleanObject(r)||isBigIntObject(r)||isSymbolObject(r)}function isAnyArrayBuffer(r){return"undefined"!=typeof Uint8Array&&(isArrayBuffer(r)||isSharedArrayBuffer(r))}BigIntSupported&&(bigIntValue=uncurryThis(BigInt.prototype.valueOf)),SymbolSupported&&(symbolValue=uncurryThis(Symbol.prototype.valueOf)),exports.isArgumentsObject=isArgumentsObject,exports.isGeneratorFunction=isGeneratorFunction,exports.isTypedArray=isTypedArray,exports.isPromise=isPromise,exports.isArrayBufferView=isArrayBufferView,exports.isUint8Array=isUint8Array,exports.isUint8ClampedArray=isUint8ClampedArray,exports.isUint16Array=isUint16Array,exports.isUint32Array=isUint32Array,exports.isInt8Array=isInt8Array,exports.isInt16Array=isInt16Array,exports.isInt32Array=isInt32Array,exports.isFloat32Array=isFloat32Array,exports.isFloat64Array=isFloat64Array,exports.isBigInt64Array=isBigInt64Array,exports.isBigUint64Array=isBigUint64Array,isMapToString.working="undefined"!=typeof Map&&isMapToString(new Map),exports.isMap=isMap,isSetToString.working="undefined"!=typeof Set&&isSetToString(new Set),exports.isSet=isSet,isWeakMapToString.working="undefined"!=typeof WeakMap&&isWeakMapToString(new WeakMap),exports.isWeakMap=isWeakMap,isWeakSetToString.working="undefined"!=typeof WeakSet&&isWeakSetToString(new WeakSet),exports.isWeakSet=isWeakSet,isArrayBufferToString.working="undefined"!=typeof ArrayBuffer&&isArrayBufferToString(new ArrayBuffer),exports.isArrayBuffer=isArrayBuffer,isDataViewToString.working="undefined"!=typeof ArrayBuffer&&"undefined"!=typeof DataView&&isDataViewToString(new DataView(new ArrayBuffer(1),0,1)),exports.isDataView=isDataView,isSharedArrayBufferToString.working="undefined"!=typeof SharedArrayBuffer&&isSharedArrayBufferToString(new SharedArrayBuffer),exports.isSharedArrayBuffer=isSharedArrayBuffer,exports.isAsyncFunction=isAsyncFunction,exports.isMapIterator=isMapIterator,exports.isSetIterator=isSetIterator,exports.isGeneratorObject=isGeneratorObject,exports.isWebAssemblyCompiledModule=isWebAssemblyCompiledModule,exports.isNumberObject=isNumberObject,exports.isStringObject=isStringObject,exports.isBooleanObject=isBooleanObject,exports.isBigIntObject=isBigIntObject,exports.isSymbolObject=isSymbolObject,exports.isBoxedPrimitive=isBoxedPrimitive,exports.isAnyArrayBuffer=isAnyArrayBuffer,["isProxy","isExternal","isModuleNamespaceObject"].forEach(function(r){Object.defineProperty(exports,r,{enumerable:!1,value:function(){throw new Error(r+" is not supported in userland")}})});