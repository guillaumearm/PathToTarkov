using System;
using SPT.Common.Http;
using Newtonsoft.Json;

using PTT.Data;

namespace PTT.Helpers;


internal static class HttpRequest
{
    private const string VERSION_PATH = "/PathToTarkov/Version";
    private const string EXFILS_TARGETS_PATH = "/PathToTarkov/CurrentLocationData";

    static public CurrentLocationDataResponse FetchCurrentLocationData(string locationId)
    {
        string jsonRequest = JsonConvert.SerializeObject(new CurrentLocationDataRequest { locationId = locationId });
        string jsonResponse = RequestHandler.PostJson(EXFILS_TARGETS_PATH, jsonRequest);
        var response = JsonConvert.DeserializeObject<CurrentLocationDataResponse>(jsonResponse);
        return response ?? throw new Exception("FetchCurrentLocationData: response is null");
    }

    static public VersionDataResponse FetchVersionData()
    {
        string jsonRequest = "{}";

        try
        {
            string jsonResponse = RequestHandler.PostJson(VERSION_PATH, jsonRequest);
            var response = JsonConvert.DeserializeObject<VersionDataResponse>(jsonResponse)
                    ?? throw new Exception("FetchVersionData: response is null");

            if (response == null || response.fullVersion == null)
            {
                Logger.Error($"FetchVersionData: response is null");
                return null;
            }

            return response;
        }
        catch (Exception ex)
        {
            Logger.Error($"FetchVersionData: {ex}");
            return null;
        }
    }
}
