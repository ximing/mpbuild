var bind=require("../function-bind/index.js"),GetIntrinsic=require("../get-intrinsic/index.js"),$apply=GetIntrinsic("%Function.prototype.apply%"),$call=GetIntrinsic("%Function.prototype.call%"),$reflectApply=GetIntrinsic("%Reflect.apply%",!0)||bind.call($call,$apply),$defineProperty=GetIntrinsic("%Object.defineProperty%",!0);if($defineProperty)try{$defineProperty({},"a",{value:1})}catch(e){$defineProperty=null}module.exports=function(){return $reflectApply(bind,$call,arguments)};var applyBind=function(){return $reflectApply(bind,$apply,arguments)};$defineProperty?$defineProperty(module.exports,"apply",{value:applyBind}):module.exports.apply=applyBind;