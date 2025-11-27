import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { DownloadIcon } from "@heroicons/react/outline";
import { useEffect, useState } from "react";
import axios from "axios";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export default function StatisticsPage() {
  const [monthlyData, setMonthlyData] = useState([]);
  const [productDistribution, setProductDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [monthlyRes, productRes] = await Promise.all([
          axios.get("/api/statistics/monthly"),
          axios.get("/api/statistics/product-distribution"),
        ]);
        setMonthlyData(monthlyRes.data);
        setProductDistribution(Array.isArray(productRes.data) ? productRes.data : []);
      } catch (error) {
        console.error("Error fetching statistics:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleDownload = async (reportType: string) => {
    try {
      const response = await axios.get(`/api/reports/${reportType}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${reportType}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading report:", error);
    }
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h2 className="text-2xl font-bold">Statistiques</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Statistiques Mensuelles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {/* Debugging Monthly Data */}
              {(() => { console.log("Monthly Data:", monthlyData); return null; })()}
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Array.isArray(monthlyData) ? monthlyData : []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="lots" fill="#8884d8" name="Lots" />
                  <Bar dataKey="farms" fill="#82ca9d" name="Fermes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Product Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribution des Produits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {productDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Downloadable Reports Section */}
      <div className="mt-6">
        <h3 className="text-xl font-semibold mb-4">Rapports Téléchargeables</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rapport de Production</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => handleDownload("production")}
              >
                <DownloadIcon className="h-5 w-5" /> Télécharger
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rapport de Livraison</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => handleDownload("delivery")}
              >
                <DownloadIcon className="h-5 w-5" /> Télécharger
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rapport Général</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => handleDownload("general")}
              >
                <DownloadIcon className="h-5 w-5" /> Télécharger
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Enhanced Statistics Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenu Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">$50,000</p>
            <p className="text-sm text-neutral-500">+15% depuis le mois dernier</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Satisfaction Client</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">92%</p>
            <p className="text-sm text-neutral-500">+3% depuis le mois dernier</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Statut des Livraisons</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">En cours</p>
            <p className="text-sm text-neutral-500">5 livraisons en attente</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}