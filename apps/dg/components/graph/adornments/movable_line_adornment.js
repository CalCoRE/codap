// ==========================================================================
//                      DG.MovableLineAdornment
//
//  Author:   William Finzer
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

sc_require('components/graph/adornments/twoD_line_adornment');
sc_require('components/graph/utilities/plot_utilities');

/** @class  Draws a movable line.

  @extends DG.TwoDLineAdornment
*/
DG.MovableLineAdornment = DG.TwoDLineAdornment.extend(
/** @scope DG.MovableLineAdornment.prototype */ 
{
  defaultColor: DG.PlotUtilities.kDefaultMovableLineColor,

  kLineSlideCur: DG.Browser.customCursorStr(static_url('cursors/LineSlide.cur'), 8, 8),
  kLineBotLeft: DG.Browser.customCursorStr(static_url('cursors/LinePivotBotLeft.cur'), 5, 12),
  kLineBotRight: DG.Browser.customCursorStr(static_url('cursors/LinePivotBotRight.cur'), 12, 12),
  kLineTopLeft: DG.Browser.customCursorStr(static_url('cursors/LinePivotTopLeft.cur'), 5, 5),
  kLineTopRight: DG.Browser.customCursorStr(static_url('cursors/LinePivotTopRight.cur'), 12, 5),

  /**
    The line is covered by three nearly transparent wider segments for hitting and hilighting
    @property { Raphael line element }
  */
  firstSegHit: null,
  secondSegHit: null,
  thirdSegHit: null,

  equationString: function() {
    var tResult = sc_super();
    return tResult + this.get('sumResidSquaredString');
  }.property(),

  /**
    The line is defined by two pivot points
    @property { Point as in { x: <>, y: <> } } in world coordinates
  */
  pivot1: null,
  pivot2: null,

  /**
    Make the pieces of the movable line. This only needs to be done once.
  */
  createElements: function() {
    var this_ = this,
      tXAxisView = this.get('xAxisView'),
      tYAxisView = this.get('yAxisView'),
      tDragPoint, tLocked, tDragging = false;

    //=============Event handling functions===============
    function logDragResult() {
      var equation = this_.get('equationString');
      // Replace Unicode minus signs (used for display) with ASCII hyphens
      equation = equation.replace(/\u2212/g, "-");
      DG.logUser("dragMovableLine: '%@'", equation);
    }

    function overScope() {
      var tAttributes = { stroke: DG.PlotUtilities.kLineHighlightColor };
      this_.firstSegHit.stop();
      this_.secondSegHit.stop();
      this_.thirdSegHit.stop();
      this_.firstSegHit.animate( tAttributes, DG.PlotUtilities.kHighlightShowTime);
      this_.secondSegHit.animate( tAttributes, DG.PlotUtilities.kHighlightShowTime);
      this_.thirdSegHit.animate( tAttributes, DG.PlotUtilities.kHighlightShowTime);
    }

    function outScope() {
      var tAttributes = { stroke: DG.RenderingUtilities.kSeeThrough };
      if( !tDragging) {
        this_.firstSegHit.stop();
        this_.secondSegHit.stop();
        this_.thirdSegHit.stop();
        this_.firstSegHit.animate( tAttributes, DG.PlotUtilities.kHighlightHideTime);
        this_.secondSegHit.animate( tAttributes, DG.PlotUtilities.kHighlightHideTime);
        this_.thirdSegHit.animate( tAttributes, DG.PlotUtilities.kHighlightHideTime);
      }
    }

    function beginDrag( iWindowX, iWindowY) {
      var tLine = { slope: this_.getPath('model.slope'),
                    intercept: this_.getPath('model.intercept') };
      tDragPoint = DG.ViewUtilities.windowToViewCoordinates(
                    { x: iWindowX, y: iWindowY }, this_.parentView);
      if( this_.getPath('model.isVertical'))
        tDragPoint.x = tXAxisView.dataToCoordinate( this_.getPath('model.xIntercept'));
      else
        tDragPoint = DG.PlotUtilities.closestScreenPtGivenScreenPtAndWorldLine(
                              tDragPoint, tLine, tXAxisView, tYAxisView);
      tLocked = this_.getPath('model.isInterceptLocked');
      overScope();
      tDragging = true;
    }

    function continueTranslate( idX, idY) {
      this_.get('model').forceThroughPoint( {  x: tXAxisView.coordinateToData( tDragPoint.x + idX),
                          y: tYAxisView.coordinateToData( tDragPoint.y + idY) });
    }

    function endTranslate( idX, idY) {
      this_.pivot1 = this_.pivot2 = null;
      this_.updateToModel();  // needed to force re-computation of pivot points
      logDragResult();
      tDragging = false;
      outScope();
    }

    function beginRotation( iWindowX, iWindowY) {
      beginDrag( iWindowX, iWindowY);
    }

    function forceLineThroughPivots( iWorldDraggedPivot, iWorldStaticPivot, iScreenDraggedPivot, iScreenStaticPivot) {
      var kTolerance = 2;
      if( Math.abs(iScreenDraggedPivot.x - iScreenStaticPivot.x) < kTolerance) {
        // Snap to vertical
        iWorldDraggedPivot.x = iWorldStaticPivot.x;
      }
      else if( Math.abs(iScreenDraggedPivot.y - iScreenStaticPivot.y) < kTolerance) {
        // Snap to horizontal
        iWorldDraggedPivot.y = iWorldStaticPivot.y;
      }

      this_.get('model').forceThroughPoints( this_.pivot1, this_.pivot2);
    }

    function continueRotation1( idX, idY) {
      var tNewDragPt = { x: tDragPoint.x + idX, y: tDragPoint.y + idY },
          tStaticPivotPt = { x: tXAxisView.dataToCoordinate( this_.pivot2.x),
                            y: tYAxisView.dataToCoordinate( this_.pivot2.y) };
      this_.pivot1.x = tXAxisView.coordinateToData( tNewDragPt.x);
      this_.pivot1.y = tYAxisView.coordinateToData( tNewDragPt.y);
      if( tLocked)
        this_.get('model').forceThroughOriginAndPoint( this_.pivot1);
      else
        forceLineThroughPivots( this_.pivot1, this_.pivot2, tNewDragPt, tStaticPivotPt);
    }

    function continueRotation2( idX, idY) {
      var tNewDragPt = { x: tDragPoint.x + idX, y: tDragPoint.y + idY },
          tStaticPivotPt = { x: tXAxisView.dataToCoordinate( this_.pivot1.x),
                            y: tYAxisView.dataToCoordinate( this_.pivot1.y) };
      this_.pivot2.x = tXAxisView.coordinateToData( tNewDragPt.x);
      this_.pivot2.y = tYAxisView.coordinateToData( tNewDragPt.y);
      if( tLocked)
        this_.get('model').forceThroughOriginAndPoint( this_.pivot2);
      else
        forceLineThroughPivots( this_.pivot2, this_.pivot1, tNewDragPt, tStaticPivotPt);
    }

    function endRotation( idX, idY) {
      if( this_.pivot1.x > this_.pivot2.x) {
        var tSwap = this_.pivot1;
        this_.pivot1 = this_.pivot2;
        this_.pivot2 = tSwap;
      }
      logDragResult();
      tDragging = false;
      outScope();
    }

    //=============Main body of createElements===============

    if( this.myElements && (this.myElements.length > 0))
      return; // already created
    sc_super(); // Creates lineSeg, backgrndRect, and equation

    var tLayer = this.get('layer');

    // Hints (implemented as titles here) were good, but they cause layering problems that
    // prevent hitting the line if you are directly over lineSeg. Consider adding the hover
    // and drag routines to lineSeg.
    this.firstSegHit = this.lineSeg.clone()
              .attr({ 'stroke-width': 12,
                  stroke: DG.RenderingUtilities.kSeeThrough//,
                  //title: "Rotate the line around other end"
      })
              .hover( overScope, outScope)
              .drag( continueRotation1, beginRotation, endRotation);
    this.secondSegHit = this.firstSegHit.clone()
              .attr( { cursor: this.kLineSlideCur })
              .hover( overScope, outScope)
              .drag( continueTranslate, beginDrag, endTranslate);
    this.thirdSegHit = this.firstSegHit.clone()
              //.attr( { title: "Rotate the line around other end" })
              .hover( overScope, outScope)
              .drag( continueRotation2, beginRotation, endRotation);

    [ this.firstSegHit, this.secondSegHit, this.thirdSegHit].forEach( function( iElement) {
      this.myElements.push( iElement);
      tLayer.push( iElement);
    }.bind( this));
    return this.myElements;
  },

  /**
    Compute the positions of the pivots based on slope and intercept of the model.
   - The line has three segments when the intercept is not locked. Each segment has a different cursor, and one
   that changes based on line orientation.
   - When the intercept is locked, the has one or two segments, two if the origin is within the plot frame, one
   otherwise.
   - The intercept points and the breakpoints are used to define the segments. tIntercepts.pt1 is always to
   the left of tIntercepts.pt2. 
  */
  updateToModel: function() {
    if( !this.getPath('model.isVisible'))
        return;
    if( this.myElements === null)
      this.createElements();
    var tXAxisView = this.get( 'xAxisView'),
        tYAxisView = this.get( 'yAxisView'),
        tModel = this.get('model'),
        tSlope = tModel.get('slope'),
        tLocked = tModel.get('isInterceptLocked'),
        tIntercept = tModel.get('intercept'),
        tXLowerBound = tXAxisView.getPath('model.lowerBound'),
        tXUpperBound = tXAxisView.getPath('model.upperBound'),
        tYLowerBound = tYAxisView.getPath('model.lowerBound'),
        tYUpperBound = tYAxisView.getPath('model.upperBound'),
        // Form of tIntercepts is { pt1: { x, y }, pt2: { x, y }} in world coordinates
        tIntercepts = (tModel.get('isVertical')) ?
                { pt1: { x: tModel.get('xIntercept'), y: tYLowerBound },
                  pt2: { x: tModel.get('xIntercept'), y: tYUpperBound }} :
                DG.PlotUtilities.lineToAxisIntercepts(
                  tSlope, tIntercept, tXAxisView.get('model'), tYAxisView.get('model') );

    function worldToScreen( iWorld) {
      return { x: tXAxisView.dataToCoordinate( iWorld.x),
               y: tYAxisView.dataToCoordinate( iWorld.y) };
    }

    function swapIntercepts() {
      var tSwap = tIntercepts.pt1;
      tIntercepts.pt1 = tIntercepts.pt2;
      tIntercepts.pt2 = tSwap;
    }

    if( tIntercepts.pt2.x < tIntercepts.pt1.x)
      swapIntercepts();

    var tTextAnchor = worldToScreen({ x: (tIntercepts.pt1.x + tIntercepts.pt2.x) / 2,
                                      y: (tIntercepts.pt1.y + tIntercepts.pt2.y) / 2 }),
        tPaperWidth = this.get('paper').width,
        tPaperHeight = this.get('paper').height,
        tBreakPt1, tBreakPt2, tTextBox, tTextWidth, tAlign, tBackgrndX;

    if( tLocked) {
      // The only break point is the origin, if it's visible.
      if( (tXLowerBound <= 0) && (tXUpperBound >= 0) && (tYLowerBound <= 0) && (tYUpperBound >= 0)) {
        tBreakPt1 = { x: 0, y: 0 };
        tBreakPt2 = tBreakPt1;
      }
      else if (tSlope >= 0) {
        if((tYUpperBound < 0) || (tXUpperBound < 0))
          tBreakPt1 = tBreakPt2 = tIntercepts.pt2;
        else
          tBreakPt1 = tBreakPt2 = tIntercepts.pt1;
      }
      else {  // tSlope < 0
        if((tYLowerBound > 0) || (tXUpperBound < 0))
          tBreakPt1 = tBreakPt2 = tIntercepts.pt2;
        else
          tBreakPt1 = tBreakPt2 = tIntercepts.pt1;
      }
    }
    else {
      tBreakPt1 = { x: tIntercepts.pt1.x + (3/8) * (tIntercepts.pt2.x - tIntercepts.pt1.x),
                    y: tIntercepts.pt1.y + (3/8) * (tIntercepts.pt2.y - tIntercepts.pt1.y) };
      tBreakPt2 = { x: tIntercepts.pt1.x + (5/8) * (tIntercepts.pt2.x - tIntercepts.pt1.x),
                    y: tIntercepts.pt1.y + (5/8) * (tIntercepts.pt2.y - tIntercepts.pt1.y) };
    }
    if( SC.none( this.pivot1) || !DG.MathUtilities.isInRange( this.pivot1.x, tXLowerBound, tXUpperBound) ||
                                  !DG.MathUtilities.isInRange( this.pivot1.y, tYLowerBound, tYUpperBound))
      this.pivot1 = tIntercepts.pt1;
    if( SC.none( this.pivot2) || !DG.MathUtilities.isInRange( this.pivot2.x, tXLowerBound, tXUpperBound) ||
                                      !DG.MathUtilities.isInRange( this.pivot2.y, tYLowerBound, tYUpperBound))
      this.pivot2 = tIntercepts.pt2;

    DG.RenderingUtilities.updateLine( this.lineSeg,
                worldToScreen( tIntercepts.pt1), worldToScreen( tIntercepts.pt2));

    DG.RenderingUtilities.updateLine( this.firstSegHit,
                worldToScreen( tIntercepts.pt1), worldToScreen( tBreakPt1));
    DG.RenderingUtilities.updateLine( this.secondSegHit,
                worldToScreen( tBreakPt1), worldToScreen( tBreakPt2));
    DG.RenderingUtilities.updateLine( this.thirdSegHit,
                worldToScreen( tBreakPt2), worldToScreen( tIntercepts.pt2));

    if( tSlope > 0) {
      this.firstSegHit.attr({ cursor: this.kLineBotLeft });
      this.thirdSegHit.attr({ cursor: this.kLineTopRight });
    }
    else {
      this.firstSegHit.attr({ cursor: this.kLineTopLeft });
      this.thirdSegHit.attr({ cursor: this.kLineBotRight });
    }

    tTextBox = this.equation.attr( { text: this.get('equationString') }).getBBox();
    tTextWidth = tTextBox.width;
    tTextWidth += 10; // padding
    if( tTextAnchor.x < tPaperWidth / 2) {
      tAlign = 'start';
      tTextAnchor.x = Math.min( tTextAnchor.x, tPaperWidth - tTextWidth);
      tBackgrndX = tTextAnchor.x;
    }
    else {
      tAlign = 'end';
      tTextAnchor.x = Math.max( tTextAnchor.x, tTextWidth);
      tBackgrndX = tTextAnchor.x - tTextBox.width;
    }
    // We don't want the equation to sit on the line because then we can't drag it
    tTextAnchor.y += tTextBox.height / 2;
    // Keep the equation inside the plot bounds
    tTextAnchor.y = Math.min( Math.max( tTextAnchor.y, tTextBox.height / 2), tPaperHeight - tTextBox.height / 2);

    // At last set the equation attributes
    this.backgrndRect.attr({ x: tBackgrndX, y: tTextAnchor.y - tTextBox.height / 2,
      width: tTextWidth, height: tTextBox.height });
    this.equation.attr( { x: tTextAnchor.x, y: tTextAnchor.y, 'text-anchor': tAlign,
                text: this.get('equationString') });
  },

  /**
    My model's visibility has changed.
  */
  updateVisibility: function() {
    if( this.getPath('model.isVisible'))
      this.pivot1 = this.pivot2 = null;

    sc_super();
  }

});

