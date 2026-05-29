import React, { useEffect, useState } from "react";
import { apiFetch } from "./api";

function ShopList({ setSelectedBarber }) {
  const [shops, setShops] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/barbers")
      .then((res) => res.json())
      .then((data) => {
        setShops(Array.isArray(data) ? data : []);
        setError(Array.isArray(data) ? "" : data.message || "Could not load shops.");
      })
      .catch((err) => {
        console.error("FETCH BARBERS ERROR:", err);
        setShops([]);
        setError("Cannot reach server. Please make sure backend is running.");
      });
  }, []);

  return (
    <div className="shop-directory">
      <div className="shop-directory__header">
        <h2>Select Shop</h2>
        <p>Choose a barber workspace with live chairs, queue visibility, and instant booking access.</p>
      </div>

      {error ? <p className="form-feedback form-feedback--error">{error}</p> : null}

      <div className="shop-directory__grid">
        {shops.map((shop) => {
          const activeChairCount = (shop.chairs || []).filter((chair) => chair.isActive).length || 0;
          const isOpen = shop.isOpen !== false;

          return (
            <button
              key={shop._id}
              className={`shop-card ${isOpen ? "shop-card--open" : "shop-card--closed"}`}
              onClick={() => setSelectedBarber(shop)}
              type="button"
            >
              <div className="shop-card__status-row">
                <span className={`shop-card__status ${isOpen ? "shop-card__status--open" : "shop-card__status--closed"}`}>
                  {isOpen ? "Open for booking" : "Currently closed"}
                </span>
                <span className="shop-card__chair-count">{activeChairCount} chairs</span>
              </div>

              <div className="shop-card__top">
                <p className="shop-card__eyebrow">Barber workspace</p>
                <h3>{shop.shopName}</h3>
              </div>

              <div className="shop-card__details">
                <p className="shop-card__meta">{shop.phone || "Phone unavailable"}</p>
                <p className="shop-card__meta">{shop.address || "Location shared after sign-in"}</p>
              </div>

              <div className="shop-card__footer">
                <span>{activeChairCount} active chairs</span>
                <span className="shop-card__cta">Choose shop</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ShopList;
