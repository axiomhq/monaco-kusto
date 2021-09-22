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