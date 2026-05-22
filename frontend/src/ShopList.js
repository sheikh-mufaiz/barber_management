import React, { useEffect, useState } from "react";

function ShopList({ setSelectedBarber }) {
  const [shops, setShops] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/barbers")
      .then((res) => res.json())
      .then((data) => setShops(data))
      .catch((err) => {
        console.error("FETCH BARBERS ERROR:", err);
        setShops([]);
      });
  }, []);

  return (
    <div>
      <h2>Select Shop</h2>

      {shops.map((shop) => (
        <div
          key={shop._id}
          onClick={() => setSelectedBarber(shop)}
          style={{ border: "1px solid black", padding: "10px", margin: "10px", cursor: "pointer" }}
        >
          <p><b>{shop.shopName}</b></p>
          <p>{shop.phone}</p>
        </div>
      ))}
    </div>
  );
}

export default ShopList;
