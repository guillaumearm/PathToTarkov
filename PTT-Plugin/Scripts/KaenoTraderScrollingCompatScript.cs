using Comfort.Common;
using EFT.UI;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace PTT.Scripts;

public class KaenoTraderScrollingCompatScript : MonoBehaviour
{
    private GameObject _traderCards;
    private RectTransform _traderCardsRect;
    private int _countCards;

    protected void Awake()
    {
        _traderCards = GameObject.Find("TraderCards");
        _traderCardsRect = _traderCards.GetComponent<RectTransform>();
        _countCards = _traderCards.transform.ActiveChildCount();

        RecomputeAnchorMin();
    }

    protected void FixedUpdate()
    {
        if (_traderCards == null || _traderCardsRect == null)
        {
            return;
        }

        int newCountCards = _traderCards.transform.ActiveChildCount();
        if (_countCards != newCountCards)
        {
            _countCards = newCountCards;
            RecomputeAnchorMin();
        }
    }

    private void RecomputeAnchorMin()
    {
        int count = _countCards - 10;

        //THIS IS DEFAULT anchorMin For anything below 11
        _traderCardsRect.anchorMin = new Vector2(0.595f, 1f);

        if (count > 0)
        {
            var offset = 0.065f * count;
            _traderCardsRect.anchorMin = new Vector2(0.595f - offset, 1f);
        }
    }
}
