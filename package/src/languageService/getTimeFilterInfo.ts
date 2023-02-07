import syntax = Kusto.Language.Syntax;

class Utilities {
    static toArray(e): any[] {
        return (Bridge as any).toArray(e);
    }
}

class TokensUtilities {
    static getFunctionsSymbols(e: syntax.SyntaxNode) {
        return TokensUtilities.getSyntaxNodes(
            e,
            Kusto.Language.Syntax.NameReference,
            function (e: syntax.SyntaxNode) {
                return (
                    e.ReferencedSymbol instanceof
                    Kusto.Language.Symbols.FunctionSymbol
                );
            }
        );
    }

    static getFirstSyntaxNode(e: syntax.SyntaxNode, t, n) {
        return e.GetFirstDescendant(t, n);
    }

    static getSyntaxNodes(e: syntax.SyntaxNode, t: {
        prototype: unknown;
    }, n?: (arg: unknown) => boolean) {
        return Utilities.toArray(e.GetDescendants(t, n));
    }
}

class SymbolsUtilities {
    static isDateTime(t) {
        return SymbolsUtilities.isColumn(t)
            ? SymbolsUtilities.isDatetimeType(t.Type)
            : t instanceof Kusto.Language.Symbols.TypeSymbol &&
            SymbolsUtilities.isDatetimeType(t);
    }
    static isColumn(e) {
        return e instanceof Kusto.Language.Symbols.ColumnSymbol;
    }
    static isDatetimeType(e) {
        return (
            e == Kusto.Language.Symbols.ScalarTypes.DateTime ||
            e == Kusto.Language.Symbols.ScalarTypes.TimeSpan
        );
    }
}

export interface TimeFilterInfo {
    totalCharactersChecked: number;
    isContainTimeFilter: boolean;
    isTimeFilterInFunction: boolean;
    parsingDurationInMS: number;
    getTimeFilterInfoDurationInMS: number;
  }

export function GetTimeFilterInfoInternal(e: syntax.SyntaxNode, t: number): TimeFilterInfo | undefined {
    const n: TimeFilterInfo = {
      totalCharactersChecked: e.toString().length,
      isContainTimeFilter: !0,
      isTimeFilterInFunction: !1,
      parsingDurationInMS: 0,
      getTimeFilterInfoDurationInMS: 0,
    };
    if (t >= 0) {
      if (
        TokensUtilities.getFirstSyntaxNode(
          e,
          Kusto.Language.Syntax.BinaryExpression,
          function (e) {
            if (
              !e.GetFirstAncestor(Kusto.Language.Syntax.FilterOperator)
            )
              return !1;
            var t = SymbolsUtilities.isColumn(
                e.Left.ReferencedSymbol
              ),
              n = SymbolsUtilities.isColumn(e.Right.ReferencedSymbol),
              a = SymbolsUtilities.isDateTime(e.Left.ResultType),
              s = SymbolsUtilities.isDateTime(e.Right.ResultType);
            return (t && s) || (n && a) || a || s;
          }
        )
      )
        return n;
      if (
        TokensUtilities.getFirstSyntaxNode(
          e,
          Kusto.Language.Syntax.BetweenExpression,
          function (e) {
            return (
              SymbolsUtilities.isDateTime(e.Left.ReferencedSymbol) ||
              SymbolsUtilities.isDateTime(e.Right.ReferencedSymbol)
            );
          }
        )
      )
        return n;
      if (
        TokensUtilities.getFirstSyntaxNode(
          e,
          Kusto.Language.Syntax.MakeSeriesOnClause,
          function (e) {
            return SymbolsUtilities.isDateTime(
              e.Expression.ReferencedSymbol
            );
          }
        )
      )
        return n;
      for (
        var a = 0, r = TokensUtilities.getFunctionsSymbols(e);
        a < r.length;
        a++
      ) {
        var o = r[a];
        if (
          o.ReferencedSymbol instanceof
          Kusto.Language.Symbols.FunctionSymbol
        ) {
          if (
            o.ReferencedSymbol == Kusto.Language.Functions.Around &&
            null !=
              o.GetFirstAncestor(Kusto.Language.Syntax.FilterOperator)
          )
            return n;
          var u = o.GetExpansion();
          if (null == u && !(u = o.Parent.GetExpansion())) continue;
          var l = GetTimeFilterInfoInternal(u, --t);
          if (
            ((n.totalCharactersChecked =
              n.totalCharactersChecked + l.totalCharactersChecked),
            l.isContainTimeFilter)
          )
            return (n.isTimeFilterInFunction = !0), n;
        }
      }
    }
    return (n.isContainTimeFilter = !1), n;
  }

export function GetTables(e: syntax.SyntaxNode) {
  const tables: string[] = TokensUtilities.getSyntaxNodes(e, Kusto.Language.Syntax.NameReference, function (node) {
    const nameRef = (node as Kusto.Language.Syntax.NameReference);

    return nameRef.ResultType.IsTabular;
  }).map((nameNode: Kusto.Language.Syntax.NameReference) => {
   return nameNode.Name.SimpleName;
  });

  return tables;
}

// Working code to get the type of an extends expression. Not being used in the hopes the backend
// will offer a better way.
// export function GetExtendsResultType(extendsVarName: string, e: syntax.SyntaxNode) {
//   const foundNode = TokensUtilities.getFirstSyntaxNode(e, Kusto.Language.Syntax.NameDeclaration, function (node) {
//     const nameDec = (node as Kusto.Language.Syntax.NameDeclaration);

//     return nameDec.Name.SimpleName === extendsVarName;
//   });

//   if (foundNode) {
//     const nameDecNode = foundNode as syntax.NameDeclaration;

//     if (nameDecNode.Parent.Kind === Kusto.Language.Syntax.SyntaxKind.SimpleNamedExpression) {
//       const parentNode = nameDecNode.Parent as syntax.SimpleNamedExpression;

//       return parentNode.ResultType.Name;
//     }

//   }
// }

// Get the types of name declarations (extends?)
export function GetResultTypes(e: syntax.SyntaxNode) {
  const mapNodeResultTypes: { [key: string]: string } = {};
  
  TokensUtilities.getSyntaxNodes(e, Kusto.Language.Syntax.NameDeclaration).forEach((node) => {
    const namedNode = (node as Kusto.Language.Syntax.NameDeclaration);
    
    if (namedNode?.Name?.SimpleName) {
      mapNodeResultTypes[namedNode.Name.SimpleName] = namedNode?.ResultType?.Name;
    }
  });

  return mapNodeResultTypes;
}