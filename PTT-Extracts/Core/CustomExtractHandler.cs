#if !UNITY_EDITOR
using SPT.Reflection.Patching;
using SPT.Reflection.Utils;
using EFT.Interactive;
using HarmonyLib;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;
using System.IO;
using Newtonsoft.Json;
using EFT.InventoryLogic;
using Comfort.Common;
using EFT;
using EFT.UI;
using static EFT.SpeedTree.TreeWind;
using UnityEngine.SceneManagement;
using PTTExtracts.Utils;
using SPT.Common.Http;
using System.Xml;

namespace PTTExtracts.Core
{
    public static class CustomExtractHandler
    {
        public static List<ExitGroup> customExtracts;

        public static void PatchExfiltrationPoints(List<ExfiltrationPoint> pmcExfilList)
        {
            // Ensure that custom extracts are loaded
            if (customExtracts == null)
            {
                Console.WriteLine("Custom extracts are not loaded. Requesting data from the server now...");
                CustomExtractUtils.LoadCustomExtracts();  // Ensure that the static field is set
            }

            // If customExtracts is still null after attempting to load, log an error and return
            if (customExtracts == null)
            {
                Console.WriteLine("Custom extracts could not be loaded. Exiting PatchExfiltrationPoints.");
                return;
            }

            string currentLocationId = CustomExtractUtils.GetCurrentLocationId()?.ToLower();

            // Proceed with processing if customExtracts is not null

            foreach (var exitGroup in customExtracts)
            {
                if (exitGroup.Id.ToLower() != currentLocationId)
                {
                    continue;
                }

                foreach (var exitData in exitGroup.exits)
                {
                    Vector3 position = new Vector3(exitData.CubeData.Position.x, exitData.CubeData.Position.y, exitData.CubeData.Position.z);
                    Vector3 scale = new Vector3(exitData.CubeData.Scale.x, exitData.CubeData.Scale.y, exitData.CubeData.Scale.z);
                    Quaternion rotation = Quaternion.Euler(exitData.CubeData.Rotation.x, exitData.CubeData.Rotation.y, exitData.CubeData.Rotation.z);
                    string name = exitData.CubeData.Name;

                    GameObject newExtractObject = CustomExtractUtils.CreateExtractionGameObject(position, scale, rotation, name);

                    if (newExtractObject == null)
                    {
                        continue;
                    }

                    ExfiltrationPoint newExtractData = CustomExtractUtils.InitializeExtractionData(newExtractObject, exitData);
                    pmcExfilList.Add(newExtractData);
                }
            }
        }

    }

    public class CustomExtractUtils
    {
        public static void LoadCustomExtracts()
        {
            try
            {
                var response = WebRequestUtils.Get<ResponseWrapper<List<ExitGroup>>>("/PathToTarkov/CustomExtracts");

                if (response != null && response.Success)
                {
                    CustomExtractHandler.customExtracts = response.Data;
                    Console.WriteLine("Custom extracts successfully retrieved from the server.");
                    // Log the entire list by serializing it to JSON
                    var jsonExtracts = JsonConvert.SerializeObject(CustomExtractHandler.customExtracts, Newtonsoft.Json.Formatting.Indented);

                }
                else
                {
                    Console.WriteLine("Error retrieving custom extracts: No data or response was unsuccessful.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error loading custom extracts: " + ex.Message);
            }
        }


        public static string GetCurrentLocationId()
        {
            TarkovApplication tarkovApplication = (TarkovApplication)Singleton<ClientApplication<ISession>>.Instance;

            RaidSettings currentRaidSettings = (RaidSettings)typeof(TarkovApplication)
                .GetField("_raidSettings", BindingFlags.Instance | BindingFlags.NonPublic)
                .GetValue(tarkovApplication);

            return currentRaidSettings?.SelectedLocation?.Id;
        }

        public static GameObject CreateExtractionGameObject(Vector3 position, Vector3 scale, Quaternion rotation, string name)
        {
            try
            {
                GameObject newCube = GameObject.CreatePrimitive(PrimitiveType.Cube);
                newCube.name = name;
                newCube.GetComponent<MeshRenderer>().enabled = false;
                BoxCollider boxCollider = newCube.AddComponent<BoxCollider>();
                newCube.transform.position = position;
                newCube.transform.localScale = scale;
                newCube.transform.rotation = rotation;
                newCube.AddComponent<ExfiltrationPoint>().ExtendedCollider = boxCollider;

                return newCube;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error creating new extract game object: " + ex.Message);
                return null;
            }
        }

        public static ExfiltrationPoint InitializeExtractionData(GameObject extractObject, ExitData exitData)
        {
            try
            {
                ExfiltrationPoint exfiltrationPointScript = extractObject.GetComponent<ExfiltrationPoint>();
                // Assuming EExfiltrationStatus is an enum
                if (Enum.TryParse<EExfiltrationStatus>(exitData?.AdditionalSettings?.Status, out EExfiltrationStatus parsedStatus))
                {
                    exfiltrationPointScript.Status = parsedStatus;
                }
                else
                {
                    // Handle the case where parsing fails
                    Console.WriteLine($"Error parsing exfiltration status: {exitData?.AdditionalSettings?.Status}");
                    // Sets default status to "RegularMode"
                    exfiltrationPointScript.Status = EExfiltrationStatus.RegularMode;
                    Console.WriteLine("Set status to RegularMode");
                }

                exfiltrationPointScript.ExfiltrationStartTime = 0f;
                exfiltrationPointScript.Settings.Name = exitData?.ExtractData?.Name;
                exfiltrationPointScript.Settings.ExfiltrationType = exitData?.ExtractData?.ExfiltrationType ?? default(EExfiltrationType);
                exfiltrationPointScript.Settings.ExfiltrationTime = exitData?.ExtractData?.ExfiltrationTime ?? 0f;
                exfiltrationPointScript.Settings.PlayersCount = exitData?.ExtractData?.PlayersCount ?? 0;
                exfiltrationPointScript.Settings.Chance = exitData?.ExtractData?.Chance ?? 0;
                exfiltrationPointScript.Settings.MinTime = exitData?.ExtractData?.MinTime ?? 0f;
                exfiltrationPointScript.Settings.MaxTime = exitData?.ExtractData?.MaxTime ?? 0f;
                exfiltrationPointScript.Settings.StartTime = exitData?.AdditionalSettings?.StartTime ?? 0;

                ExfiltrationRequirement requirement = new ExfiltrationRequirement();
                if (Enum.TryParse<ERequirementState>(exitData?.ExtractData?.Requirement, out ERequirementState parsedRequirement))
                {
                    requirement.Requirement = parsedRequirement;
#if DEBUG
                    Console.WriteLine($"Extract Requirement: {requirement.Requirement}");
#endif
                }
                else
                {
                    // Handle the case where the string doesn't match any enum value
                    Console.WriteLine($"Error parsing requirement state: {exitData?.ExtractData?.Requirement}");
                    // Sets default state to None
                    requirement.Requirement = ERequirementState.None;
                    Console.WriteLine("Set requirement state to None");
                }
                requirement.Id = exitData?.ExtractData?.Id;
                requirement.Count = exitData?.ExtractData?.Count ?? 69;
                if (Enum.TryParse<EquipmentSlot>(exitData?.ExtractData?.RequiredSlot, out EquipmentSlot parsedSlot))
                {
                    requirement.RequiredSlot = parsedSlot;
#if DEBUG
                    Console.WriteLine($"Parsed Required Slot: {requirement.RequiredSlot}");
#endif
                }
                else
                {
                    Console.WriteLine($"Error parsing equipment slot: {exitData?.ExtractData?.RequiredSlot}");
                }
                requirement.RequirementTip = exitData?.ExtractData?.RequirementTip; // Replace with the desired tip
#if DEBUG
                Console.WriteLine($"Requirement Tip: {requirement.RequirementTip}");
#endif
                exfiltrationPointScript.Requirements = new ExfiltrationRequirement[] { requirement };
#if DEBUG
                Console.WriteLine("Requirements added successfully.");
#endif
                return exfiltrationPointScript;

            }
            catch (Exception ex)
            {
                Console.WriteLine("Error initializing ExfiltrationPoint data: " + ex.Message);
                return null;
            }
        }

    }

    public class ExitData
    {
        public ExtractData ExtractData { get; set; }
        public AdditionalSettings AdditionalSettings { get; set; }
        public CubeData CubeData { get; set; } // Add this property
    }
    public class PositionData
    {
        public float x { get; set; }
        public float y { get; set; }
        public float z { get; set; }
    }
    public class ExtractData
    {
        public int Chance { get; set; }
        public string EntryPoints { get; set; }
        public float ExfiltrationTime { get; set; }
        public string Id { get; set; }
        public float MaxTime { get; set; }
        public float MinTime { get; set; }
        public string Name { get; set; }
        public int PlayersCount { get; set; }
        public string Requirement { get; set; }
        public int Count { get; set; }
        public string RequiredSlot { get; set; }
        public string RequirementTip { get; set; }
        public EExfiltrationType ExfiltrationType { get; set; } // Add this property
    }
    public class AdditionalSettings
    {
        public int StartTime { get; set; }
        public string Status { get; set; }
    }
    public class ExitGroup
    {
        public string Id { get; set; }
        public List<ExitData> exits { get; set; }
    }
    public class CubeData
    {
        public string Name { get; set; }
        public PositionData Position { get; set; }
        public Vector3 Scale { get; set; }
        public Vector3 Rotation { get; set; }
    }

}
#endif