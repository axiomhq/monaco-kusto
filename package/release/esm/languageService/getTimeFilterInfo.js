var Utilities = /** @class */ (function () {
    function Utilities() {
    }
    Utilities.toArray = function (e) {
        return Bridge.toArray(e);
    };
    return Utilities;
}());
var TokensUtilities = /** @class */ (function () {
    function TokensUtilities() {
    }
    TokensUtilities.getFunctionsSymbols = function (e) {
        return TokensUtilities.getSyntaxNodes(e, Kusto.Language.Syntax.NameReference, function (e) {
            return (e.ReferencedSymbol instanceof
                Kusto.Language.Symbols.FunctionSymbol);
        });
    };
    TokensUtilities.getFirstSyntaxNode = function (e, t, n) {
        return e.GetFirstDescendant(t, n);
    };
    TokensUtilities.getSyntaxNodes = function (e, t, n) {
        return Utilities.toArray(e.GetDescendants(t, n));
    };
    return TokensUtilities;
}());
var SymbolsUtilities = /** @class */ (function () {
    function SymbolsUtilities() {
    }
    SymbolsUtilities.isDateTime = function (t) {
        return SymbolsUtilities.isColumn(t)
            ? SymbolsUtilities.isDatetimeType(t.Type)
            : t instanceof Kusto.Language.Symbols.TypeSymbol &&
                SymbolsUtilities.isDatetimeType(t);
    };
    SymbolsUtilities.isColumn = function (e) {
        return e instanceof Kusto.Language.Symbols.ColumnSymbol;
    };
    SymbolsUtilities.isDatetimeType = function (e) {
        return (e == Kusto.Language.Symbols.ScalarTypes.DateTime ||
            e == Kusto.Language.Symbols.ScalarTypes.TimeSpan);
    };
    return SymbolsUtilities;
}());
export function GetTimeFilterInfoInternal(e, t) {
    var n = {
        totalCharactersChecked: e.toString().length,
        isContainTimeFilter: !0,
        isTimeFilterInFunction: !1,
        parsingDurationInMS: 0,
        getTimeFilterInfoDurationInMS: 0,
    };
    if (t >= 0) {
        if (TokensUtilities.getFirstSyntaxNode(e, Kusto.Language.Syntax.BinaryExpression, function (e) {
            if (!e.GetFirstAncestor(Kusto.Language.Syntax.FilterOperator))
                return !1;
            var t = SymbolsUtilities.isColumn(e.Left.ReferencedSymbol), n = SymbolsUtilities.isColumn(e.Right.ReferencedSymbol), a = SymbolsUtilities.isDateTime(e.Left.ResultType), s = SymbolsUtilities.isDateTime(e.Right.ResultType);
            return (t && s) || (n && a) || a || s;
        }))
            return n;
        if (TokensUtilities.getFirstSyntaxNode(e, Kusto.Language.Syntax.BetweenExpression, function (e) {
            return (SymbolsUtilities.isDateTime(e.Left.ReferencedSymbol) ||
                SymbolsUtilities.isDateTime(e.Right.ReferencedSymbol));
        }))
            return n;
        if (TokensUtilities.getFirstSyntaxNode(e, Kusto.Language.Syntax.MakeSeriesOnClause, function (e) {
            return SymbolsUtilities.isDateTime(e.Expression.ReferencedSymbol);
        }))
            return n;
        for (var a = 0, r = TokensUtilities.getFunctionsSymbols(e); a < r.length; a++) {
            var o = r[a];
            if (o.ReferencedSymbol instanceof
                Kusto.Language.Symbols.FunctionSymbol) {
                if (o.ReferencedSymbol == Kusto.Language.Functions.Around &&
                    null !=
                        o.GetFirstAncestor(Kusto.Language.Syntax.FilterOperator))
                    return n;
                var u = o.GetExpansion();
                if (null == u && !(u = o.Parent.GetExpansion()))
                    continue;
                var l = GetTimeFilterInfoInternal(u, --t);
                if (((n.totalCharactersChecked =
                    n.totalCharactersChecked + l.totalCharactersChecked),
                    l.isContainTimeFilter))
                    return (n.isTimeFilterInFunction = !0), n;
            }
        }
    }
    return (n.isContainTimeFilter = !1), n;
}
