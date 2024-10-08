```mermaid
flowchart TD
    Lab{Laboratory}
    GZ{Ground Zero}
    Streets{Streets of Tarkov}
    I{Interchange}
    C{Customs}
    F{Factory}
    W{Woods}
    R{Military reserve}
    L{Lighthouse}
    Shoreline{Shoreline}

    Prapor[[Prapor's stash]]
    Therapist[["Therapist's stash"]]
    Mechanic[["Mechanic's stash (home)"]]
    Ragman[[Ragman's stash]]
    Skier[[Skier's stash]]
    Peacekeeper[[Peacekeeper's stash]]
    Jaeger[[Jaeger's stash]]
    MilitaryLighthouseStash[[a stash near the military reserve]]
    ReserveInterchangeBunkerStash[[an underground stash in a bunker]]
    ShorelineWoodsStash[[a stash between shoreline and woods]]

    %% The normal default path
    Lab <--Any--> Prapor
    GZ <--Car--> Prapor
    Streets <--Car--> Prapor
    Streets <--Collapsed crane--> Therapist <--Railroad to tarkov--> C
    C <--Railroad to military base--> Skier <--Scav lands--> R
    R <--Checkpoint fence--> MilitaryLighthouseStash <--Road to military base--> L
    L <--Southern road--> Peacekeeper <--Tunnel--> Shoreline
    C <--Old gas station gate--> Ragman <--Railway exfil--> I
    C <--Factory far corner--> Mechanic <--Gate 3--> F
    F <--Office window--> Jaeger <--Factory gate--> W

    %% Additional shortcuts
    Therapist <--Scav checkpoint--> GZ
    I <--Safe room--> ReserveInterchangeBunkerStash <--"D-2"--> R
    Shoreline <--Car--> ShorelineWoodsStash <--Car--> W

    Shoreline <--Old bunker--> ReserveInterchangeBunkerStash
    I <--Car--> Prapor
```
