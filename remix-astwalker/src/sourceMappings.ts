import { isAstNode, AstWalker } from './astWalker';
import { AstNode, LineColPosition, LineColRange, Location } from "./types";
const util = require("remix-lib").util;

export declare interface SourceMappings {
  new(): SourceMappings;
}

// This is intended to be compatibile with VScode's Position.
// However it is pretty common with other things too.
// Note: File index is missing here
type LineBreaks = Array<number>;

/**
 * Turn an character offset into a LineColPosition
 *
 * @param {Number} offset  - the character offset to convert.
 * @returns {LineColPosition}
 */
export function lineColPositionFromOffset(offset: number, lineBreaks: LineBreaks): LineColPosition {
  let line: number = util.findLowerBound(offset, lineBreaks);
  if (lineBreaks[line] !== offset) {
    line += 1;
  }
  const beginColumn = line === 0 ? 0 : (lineBreaks[line - 1] + 1);
  return <LineColPosition>{
    line: line + 1,
    character: (offset - beginColumn) + 1
  }
}

/**
 * Turn an AST's "src" attribute string (s:l:f)
 * into a Location
 *
 * @param {AstNode} astNode  - the object to convert.
 * @returns {Location} | null
 */
export function sourceLocationFromAstNode(astNode: AstNode): Location | null {
  if (isAstNode(astNode) && astNode.src) {
    return sourceLocationFromSrc(astNode.src)
  }
  return null;
}

/**
 * Break out fields of an AST's "src" attribute string (s:l:f)
 * into its "start", "length", and "file index" components
 * and return that as a Location
 *
 * @param {String} src  - A solc "src" field
 * @returns {Location}
 */
export function sourceLocationFromSrc(src: string): Location {
  const split = src.split(':')
  return <Location>{
    start: parseInt(split[0], 10),
    length: parseInt(split[1], 10),
    file: parseInt(split[2], 10)
  }
}

/**
 * Routines for retrieving AST object(s) using some criteria, usually
 * includng "src' information.
 */
export class SourceMappings {

  readonly source: string;
  readonly lineBreaks: LineBreaks;

  constructor(source: string) {
    this.source = source;

    // Create a list of line offsets which will be used to map between
    // character offset and line/column positions.
    let lineBreaks: LineBreaks = [];
    for (var pos = source.indexOf('\n'); pos >= 0; pos = source.indexOf('\n', pos + 1)) {
      lineBreaks.push(pos)
    }
    this.lineBreaks = lineBreaks;
  };

  /**
   * get a list of nodes that are at the given @arg position
   *
   * @param {String} astNodeType - type of node to return or null
   * @param {Int} position     - character offset
   * @return {Object} ast object given by the compiler
   */
  nodesAtPosition(astNodeType: string | null, position: Location, ast: AstNode): Array<AstNode> {
    const astWalker = new AstWalker()
    let found: Array<AstNode> = [];

    const callback = function(node: AstNode): boolean {
      let nodeLocation = sourceLocationFromAstNode(node);
      if (nodeLocation &&
        nodeLocation.start == position.start &&
        nodeLocation.length == position.length) {
        if (!astNodeType || astNodeType === node.nodeType) {
          found.push(node)
        }
      }
      return true;
    }
    astWalker.walkFull(ast, callback);
    return found;
  }

  /**
   * Retrieve the first @arg astNodeType that include the source map at arg instIndex
   *
   * @param {String | undefined} astNodeType - nodeType that a found ASTNode must be. Use "null" if any ASTNode can match
   * @param {Location} sourceLocation - "src" location that the AST node must match
   * @return {AstNode | null} ast object matching source and nodeType or "null" if node matches
   */
  findNodeAtSourceLocation(astNodeType: string | undefined, sourceLocation: Location, ast: AstNode | null): AstNode | null {
    const astWalker = new AstWalker()
    let found = null;
    /* FIXME: Looking at AST walker code,
       I don't understand a need to return a boolean. */
    const callback = function(node: AstNode) {
      let nodeLocation = sourceLocationFromAstNode(node);
      if (nodeLocation &&
        nodeLocation.start == sourceLocation.start &&
        nodeLocation.length == sourceLocation.length) {
        if (astNodeType == undefined || astNodeType === node.nodeType) {
          found = node;
        }
      }
      return true;
    }

    astWalker.walkFull(ast, callback);
    return found;
  }

  /**
   * Retrieve the line/column range position for the given source-mapping string
   *
   * @param {String} src - object containing attributes {source} and {length}
   * @return {LineColRange} returns an object {start: {line, column}, end: {line, column}} (line/column count start at 0)
   */
  srcToLineColumnRange(src: string): LineColRange {
    const sourceLocation = sourceLocationFromSrc(src);
    if (sourceLocation.start >= 0 && sourceLocation.length >= 0) {
      return <LineColRange>{
        start: lineColPositionFromOffset(sourceLocation.start, this.lineBreaks),
        end: lineColPositionFromOffset(sourceLocation.start + sourceLocation.length, this.lineBreaks)
      }
    } else {
      return <LineColRange>{
        start: null,
        end: null
      }
    }
  }

}
