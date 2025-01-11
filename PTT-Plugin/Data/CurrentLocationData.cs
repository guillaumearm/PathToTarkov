using System.Collections.Generic;

namespace PTT.Data;

/**
* Request
**/
public class CurrentLocationDataRequest
{
    public string locationId;
}

/**
* Response
**/
public class CurrentLocationDataResponse
{
    // indexed by exit name
    public Dictionary<string, List<ExfilTarget>> exfilsTargets;
}
