using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using SPT.Common.Http;
using Newtonsoft.Json;

namespace PTT.Data;

/**
* Request
**/
public class ExfilsTargetsRequest
{
    public string locationId;
}

/**
* Response
**/
public class ExfilsTargetsResponse
{
    // indexed by exit name
    public Dictionary<string, List<ExfilTarget>> data;
}

public class ExfilTarget
{
    public bool isTransit;
    public string transitMapId; // transit only
    public string transitSpawnPointId; // transit only
    public string offraidPosition; // empty on transit
}