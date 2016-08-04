// ==========================================================================
//                          DG.FormulaContext
//  
//  Author:   Kirk Swenson
//
//  Copyright (c) 2014 by The Concord Consortium, Inc. All rights reserved.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
// ==========================================================================

sc_require('formula/function_registry');

/** @class DG.FormulaContext

  DG.FormulaContext objects support DG.Formula objects by providing identifier
  binding and evaluation, function binding and evaluation, etc.

  @extends SC.Object
*/
DG.FormulaContext = SC.Object.extend( (function() {

  /**
    Utility function for check argument count.
    @param    {String}    iName -- The name of the function
    @param    {Array}     iArgs -- The arguments to the function
    @param    {Object}    iFnProps -- An object which contains argument specs for
                            multiple functions, e.g. iArgsSpecs[iName] is the
                            specification for the 'iName' function. The specification
                            is an object with 'minArgs' and 'maxArgs' properties.
   */
  var checkArgs = function( iName, iArgs, iArgSpecs) {
        var fArgs = iArgSpecs && iArgSpecs[iName];
        if( fArgs && (iArgs.length < fArgs.minArgs))
          throw new DG.FuncArgsError( iName, fArgs);
      };

  return {
  
  /**
    During compilation, a stack of function contexts indicating the functions
    being processed, e.g. in the expression mean(count(round(x))), when x is
    compiled there are three function contexts on the stack.
    @type {object[]}
   */
  _functionContextStack: null,

  /**
    Initialization function
   */
  init: function() {
    this._functionContextStack = [];
  },

  /**
    Adds a function context to the top of stack
    @param  {object}  iFunctionContext
   */
  beginFunctionContext: function(iFunctionContext) {
    this._functionContextStack.push(iFunctionContext);
  },

  /**
    Pops a function context from the top of the stack
    @param  {object}  iFunctionContext
   */
  endFunctionContext: function(iFunctionContext) {
    var endName = iFunctionContext && iFunctionContext.name,
        stackSize = this._functionContextStack.length,
        topName = stackSize ? this._functionContextStack[stackSize - 1].name : '';
    if (endName === topName)
      -- this._functionContextStack.length;
    else
      DG.logError("Error: DG.FormulaContext.endFunctionContext -- attempt to end incorrect function context");
  },

  /**
    Returns an array of aggregate function indices representing the aggregate
    functions that are on the _functionContextStack at the moment.
    @returns {number[]}
   */
  getAggregateFunctionIndices: function() {
    return [];
  },

  /**
    Called when a dependency is identified during compilation.
    @param {object}   iDependency
    @param {object}   .dependentSpec - the specs of the node that is dependant
    @param {string}     .type - the type of the node that is dependant
    @param {string}     .id - the id of the node that is dependant
    @param {string}     .name - the name of the node that is dependant
                        defaults to the ownerSpec of the current context
    @param {object}   .independentSpec - the specs of the node being depended upon
    @param {string}     .type - the type of the node being depended upon
    @param {string}     .id - the id of the node being depended upon
    @param {string}     .name - the name of the node being depended upon
    @param {number[]} .aggFnIndices - array of aggregate function indices
                          defaults to the aggregate functions on the stack
                          at compile time when the variable is bound
    @param {object}   .dependentContext - the formula context for the dependent node
   */
  registerDependency: function(iDependency) {
  },

  invalidateNamespace: function() {
    this.notifyPropertyChange('namespaceChange');
  },

  /**
    Invalidation function for use with the dependency manager.
    Called by the dependency manager when invalidating nodes as a result
    of tracked dependencies.
    @param {object}     ioResult
    @param {object}     iDependent
    @param {object}     iDependency
    @param {DG.Case[]}  iCases - array of cases affected
                                 if no cases specified, all cases are affected
    @param {boolean}    iForceAggregate - treat the dependency as an aggregate dependency
   */
  invalidateDependent: function(ioResult, iDependent, iDependency, iCases, iForceAggregate) {
  },
  
  /**
    Returns true if the specified function name refers to an aggregate function.
    Derived classes may override as appropriate.
   */
  isAggregate: function(iName) {
    return false;
  },

  /**
    Clear any cached bindings for this formula. Called before compiling.
    Derived classes may override as appropriate.
   */
  clearCaches: function() {
  },

  /**
    Called when the formula is about to be recompiled to clear any cached data.
    Derived classes may override as appropriate.
   */
  willCompile: function() {
    this.clearCaches();
  },

  /**
    Called when the formula has been recompiled to clear any stale dependencies.
    Derived classes may override as appropriate.
   */
  didCompile: function() {
  },

  /**
    Called when dependents change to clear function caches.
    Derived classes may override as appropriate.
   */
  invalidateFunctions: function(iFunctionIndices) {
  },

  /**
    Compiles a variable reference into the JavaScript code for accessing
    the appropriate value. For the base FormulaContext, this means
    binding to global constants such as 'pi' and 'e'.
    @param    {String}    iName -- The variable name to be bound
    @returns  {String}    The JavaScript code for accessing the value
    @throws   {VarReferenceError} Base class throws VarReferenceError for
                                  variable names that are not recognized.
   */
  compileVariable: function( iName) {
    switch( iName) {
    case 'pi':
    case 'π':
      return 'Math.PI';
    case 'e':
      return 'Math.E';
    default:
      var eVars = this.get('eVars');
      if( eVars && (eVars[iName] !== undefined))
        return 'e.' + iName;

      var vars = this.get('vars');
      if( vars && (vars[iName] !== undefined))
        return 'c.vars.' + iName;
    }
    this.registerDependency({ independentSpec: {
                                type: DG.DEP_TYPE_UNDEFINED,
                                id: iName,
                                name: iName
                            }});
    return '(function(){throw new DG.VarReferenceError(' + iName + ');})()';
  },
  
  /**
    Direct evaluation of the variable without an intervening compilation.
    For the base FormulaContext, this means binding to global constants such as 'pi' and 'e'.
    @param    {String}    iName -- The variable name to be bound
    @returns  {Object}    Return value can be a Number, String, Boolean, error object, etc.
    @throws   {DG.VarReferenceError}  Throws VarReferenceError for variable
                                      names that are not recognized.
   */
  evaluateVariable: function( iName, iEvalContext) {
    switch( iName) {
    case 'pi':
    case 'π':
      return Math.PI;
    case 'e':
      return Math.E;
    default:
      var eValue = iEvalContext && iEvalContext[ iName];
      if( eValue !== undefined)
        return eValue;
      var vars = this.get('vars');
      if( vars && (vars[iName] !== undefined))
        return vars[iName];
    }
    throw new DG.VarReferenceError( iName);
  },
  
  /**
    Returns true if this context's formula contains aggregate functions, false otherwise.
    @property {Boolean}
   */
  hasAggregates: false,

  /**
    Property which provides implementation of functions supported by the FormulaContext.
    @property   {Object}  Map of function name {String} to function implementations {Function}.
   */
  _fns: {
    
    /**
      Coerces its argument to a boolean value.
      @param    {Object}  x The argument to be coerced to boolean
      @returns  {Boolean} The converted boolean value
     */
    'boolean': function(x) {
      return Boolean(x);
    },
    
    /**
      Returns the fractional part of its argument.
      @param    {Number}  The numeric value whose fractional part is to be returned
      @returns  {Number}  The fractional part of its numeric argument
     */
    'frac': function(x) {
      return x - this.trunc(x);
    },

    'isFinite': function(x) {
      return DG.isFinite(x);
    },
    
    /**
      Returns the natural logarithm (base e) of its argument.
      @param    {Number}  The numeric value whose natural log is to be returned
      @returns  {Number}  The natural log of its numeric argument
     */
    'ln': function(x) {
      return Math.log(x);
    },
    
    /**
      Returns the base 10 logarithm of its argument. Note: We override Math.log
      to provide the base 10 log here. Use ln() for the natural log.
      @param    {Number}  The numeric value base 10 log is to be returned
      @returns  {Number}  The base 10 log of its numeric argument
     */
    'log': function(x) {
      return Math.log(x) / Math.LN10;
    },
    
    /**
      Coerces its argument to a numeric value.
      @param    {Object}  The argument to be coerced to a number
      @returns  {Number}  The converted numeric value
     */
    'number': function(x) {
      return Number(x);
    },
    
    /**
      Random number generator. Override of Math.random() to provide more flexibility.
      random()        -- Generates a random number in the range [0,1).
      random(max)     -- Generates a random number in the range [0,max).
      random(min,max) -- Generates a random number in the range [min,max).
      @param    {Number}  x1 -- If present alone, the maximum value of the random number.
                                If first of two argument, the minimum value of the random number.
      @param    {Number}  x2 -- The maximum value of the random number.
      @returns  {Number}  The generated random number
     */
    'random': function(x1,x2) {
      // random()
      if( SC.none(x1))
        return Math.random();
      // random(max)
      if( SC.none(x2))
        return x1 * Math.random();
      // random(min,max)
      return x1 + (x2 - x1) * Math.random();
    },
    
    /**
      Rounds a number to the nearest integer or specified decimal place.
      @param    {Number}  x -- The number to be rounded
      @param    {Number}  n -- {optional} The number of decimal places to round to (default 0).
      @returns  {Number}  The rounded result
     */
    'round': function(x,n) {
      if( SC.none(n))
        return Math.round(x);
      var npow = Math.pow(10, this.trunc(n));
      return Math.round(npow * x) / npow;
    },
    
    /**
      Coerces its argument to a string value.
      @param    {Object}  The argument to be coerced to a string
      @returns  {String}  The converted string value
     */
    'string': function(x) {
      return String(x);
    },
    
    /**
      Returns the integer part of its argument.
      @param    {Number}  The numeric value whose integer part is to be returned
      @returns  {Number}  The integer part of its numeric argument
     */
    'trunc': function(x) {
      return x < 0 ? Math.ceil(x) : Math.floor(x);
    },

    /**
      Returns the great circle distance between the two lat/long points on the earth's surface.
      @param    {Number}  The latitude in degrees of the first point
      @param    {Number}  The longitude in degrees of the first point
      @param    {Number}  The latitude in degrees of the second point
      @param    {Number}  The longitude in degrees of the second point
      @returns  {Number}  The distance in kilometers between the two points
     */
    'greatCircleDistance': function(lat1, long1, lat2, long2) {
    	var deltaLat = lat2 - lat1,
    		deltaLong = long2 - long1,
    		a = Math.pow(Math.sin((Math.PI / 180) * deltaLat/2), 2) + 
    			Math.cos(lat1 * Math.PI / 180) * Math.cos (lat2 * Math.PI / 180) * 
    				Math.pow(Math.sin((Math.PI / 180) * deltaLong/2), 2);
    	return 2*6371*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    },

    /**
      Returns a string treating the argument as seconds in an epoch
      @param    {Number}  A number of seconds in the epoch beginning Jan 1, 1970
      @returns  {String}  A date
     */
    'secondsToDate': function(x) {
      var tDate = new Date( x * 1000);
      return tDate.toLocaleDateString();
    },

    /**
      Returns the month corresponding to the given date
      @param    {String|Number}  A date string or number of seconds in epoch
      @returns  {String}  The month for the given date
     */
    'month': function(x) {
      if( DG.isFinite(x))
        x *= 1000;
      var tDate = new Date( x);
      switch( tDate.getMonth()) {
        case 0:
          return 'January';
        case 1:
          return 'February';
        case 2:
          return 'March';
        case 3:
          return 'April';
        case 4:
          return 'May';
        case 5:
          return 'June';
        case 6:
          return 'July';
        case 7:
          return 'August';
        case 8:
          return 'September';
        case 9:
          return 'October';
        case 10:
          return 'November';
        case 11:
          return 'December';
      }
    }
  },

  /**
    Property which provides meta-data about the functions supported by the '_fns' property.
    @property   {Object}  Map of name {String} to {Object}.
   */
  _fnsProps: {
    'boolean': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryConversion' },
    'frac': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryArithmetic' },
    'ln': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryArithmetic' },
    'log': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryArithmetic' },
    'number': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryConversion' },
    'random': { minArgs:0, maxArgs:2, isRandom: true, category: 'DG.Formula.FuncCategoryRandom' },
    'round': { minArgs:1, maxArgs:2, category: 'DG.Formula.FuncCategoryArithmetic' },
    'string': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryConversion' },
    'trunc': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryArithmetic' },
    'greatCircleDistance': { minArgs:4, maxArgs:4, category: 'DG.Formula.FuncCategoryOther' },
    'secondsToDate': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryDateTime' },
    'month': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryDateTime' }
  },
  
  /**
    Property which provides meta-data about the functions supported by the JavaScript Math class.
    @property   {Object}  Map of name {String} to {Object}.
   */
  _MathFnProps: {
    'abs': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryArithmetic' },
    'acos': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryTrigonometric' },
    'asin': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryTrigonometric' },
    'atan': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryTrigonometric' },
    'atan2': { minArgs:2, maxArgs:2, category: 'DG.Formula.FuncCategoryTrigonometric' },
    'ceil': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryArithmetic' },
    'cos': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryTrigonometric' },
    'exp': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryArithmetic' },
    'floor': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryArithmetic' },
    //'log': { minArgs:1, maxArgs:1 },    // replaced by DG version
    //'max': { minArgs:1, maxArgs:'n' },  // replaced by aggregate version
    //'min': { minArgs:1, maxArgs:'n' },  // replaced by aggregate version
    'pow': { minArgs:2, maxArgs:2, category: 'DG.Formula.FuncCategoryArithmetic' },
    //'random': { minArgs:0, maxArgs:0 }, // replaced by DG version
    //'round': { minArgs:1, maxArgs:1 },  // replaced by DG version
    'sin': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryTrigonometric' },
    'sqrt': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryArithmetic' },
    'tan': { minArgs:1, maxArgs:1, category: 'DG.Formula.FuncCategoryTrigonometric' }
  },
  
  /**
    Compiles a function reference into the JavaScript code for evaluating
    the appropriate function. For the base FormulaContext, this means
    binding to global functions such as ln(), log(), round(), etc. as well
    as the standard JavaScript Math functions (sin(), cos(), atan()), etc.
    @param    {String}    iName -- The name of the function to be called.
    @param    {String[]}  iArgs -- array of arguments to the function
    @param    {Number[]}  iAggFnIndices -- array of aggregate function indices
                            indicating the aggregate function call stack, which
                            determines the aggregates that must be invalidated
                            when a dependent changes.
    @returns  {String}    The JavaScript code for calling the specified function
    @throws   {DG.FuncReferenceError} Throws DG.FuncReferenceError for function
                                      names that are not recognized.
   */
  compileFunction: function( iName, iArgs, iAggFnIndices) {

    var checkArgsAndRandom = function(iName, iFns, iFnPropsMap) {
      var fnProps = iFnPropsMap && iFnPropsMap[iName],
          isRandom = fnProps && fnProps.isRandom;
      // validate arguments
      checkArgs(iName, iArgs, iFnPropsMap);
      if (isRandom) {
        // register the 'random' dependency for invalidation
        this.registerDependency({ independentSpec: {
                                    type: DG.DEP_TYPE_SPECIAL,
                                    id: 'random',
                                    name: 'random'
                                  },
                                  aggFnIndices: iAggFnIndices
                                });
      }
    }.bind(this);
    
    // Functions provided by built-in '_fns' property of context
    var _fns = this.get('_fns');
    if( _fns && typeof _fns[iName] === 'function') {
      checkArgsAndRandom( iName, iArgs, this.get('_fnsProps'));
      return 'c._fns.' + iName + '(' + iArgs + ')';
    }

    // Other functions of JavaScript Math object
    if( typeof Math[iName] === 'function') {
      checkArgsAndRandom( iName, iArgs, this._MathFnProps);
      return 'Math.' + iName + '(' + iArgs + ')';
    }

    // Functions provided by client-provided 'fns' property of context
    var fns = this.get('fns');
    if( fns && typeof fns[iName] === 'function') {
      checkArgsAndRandom( iName, iArgs, this.get('fnsProps'));
      return 'c.fns.' + iName + '(' + iArgs + ')';
    }

    return '(function(){throw new DG.FuncReferenceError(' + iName + ');})()';
  },

  /**
    Evaluates a function reference directly without compilation. For the base 
    FormulaContext, this means binding to global functions such as ln(), log(), 
    round(), etc. as well as the standard JavaScript Math functions (sin(), cos(), 
    atan(), etc.).
    @param    {String}    iName -- The name of the function to be called.
    @param    {Array}     iArgs -- the arguments to the function
    @returns  {String}    The JavaScript code for calling the specified function
    @throws   {DG.FuncReferenceError} Throws DG.FuncReferenceError for function
                                      names that are not recognized.
   */
  evaluateFunction: function( iName, iArgs) {
  
    // Functions provided by built-in '_fns' property of context
    var _fns = this.get('_fns');
    if( _fns && typeof _fns[iName] === 'function') {
      checkArgs( iName, iArgs, this.get('_fnsProps'));
      return _fns[iName].apply( _fns, iArgs);
    }

    // Other functions of JavaScript Math object
    if( typeof Math[iName] === 'function') {
      checkArgs( iName, iArgs, this._MathFnProps);
      return Math[iName].apply( Math, iArgs);
    }

    // Functions provided by client-provided 'fns' property of context
    var fns = this.get('fns');
    if( fns && typeof fns[iName] === 'function') {
      checkArgs( iName, iArgs, this.get('fnsProps'));
      return fns[iName].apply( fns, iArgs);
    }

    throw new DG.FuncReferenceError( iName);
  }
  
  }; // end of closure return statement

}()));

/**
  Returns an evaluable JavaScript function that returns the value
  of the specified expression. The function created is of the form:
    function( c, e) { return iExpression };
  where c is the formula context/compile context and e is the evaluation context.
  @returns  {Function}  The evaluable function
 */
DG.FormulaContext.createContextFunction = function( iExpression) {
  /* jslint evil:true */  // allow use of the Function constructor
  return new Function('c', 'e', 'return ' + iExpression);
};

// Register the base function modules built into the context.
DG.functionRegistry.registerFunctions(DG.FormulaContext.prototype._fnsProps);
DG.functionRegistry.registerFunctions(DG.FormulaContext.prototype._MathFnProps);

