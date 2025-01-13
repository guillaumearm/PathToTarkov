using System;
using SPT.Common.Http;
using Newtonsoft.Json;

using PTT.Data;

namespace PTT.Helpers;


internal static class HttpRequest
{
    private const string EXFILS_TARGETS_PATH = "/PathToTarkov/CurrentLocationData";

    static public CurrentLocationDataResponse FetchCurrentLocationData(string locationId)
    {
        string jsonRequest = JsonConvert.SerializeObject(new CurrentLocationDataRequest { locationId = locationId });
        string jsonResponse = RequestHandler.PostJson(EXFILS_TARGETS_PATH, jsonRequest);
        var response = JsonConvert.DeserializeObject<CurrentLocationDataResponse>(jsonResponse);
        return response ?? throw new Exception("FetchExfilsTargets: response is null");
    }
}
