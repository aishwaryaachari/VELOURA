package com.veloura.api;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.Consumes;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

@Path("/cosmetics")
public class CosmeticResource {

    // GET - Retrieve all cosmetics
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public String getAllCosmetics() {

        StringBuilder json = new StringBuilder();
        json.append("[");

        String sql = "SELECT * FROM COSMETIC";

        try {

            Connection conn = DatabaseConnection.getConnection();
            PreparedStatement pst = conn.prepareStatement(sql);
            ResultSet rs = pst.executeQuery();

            boolean first = true;

            while (rs.next()) {

                if (!first) {
                    json.append(",");
                }

                json.append("{");

                json.append("\"cosmeticId\":")
                        .append(rs.getInt("COSMETIC_ID"))
                        .append(",");

                json.append("\"cosmeticName\":\"")
                        .append(rs.getString("COSMETIC_NAME"))
                        .append("\",");

                json.append("\"category\":\"")
                        .append(rs.getString("CATEGORY"))
                        .append("\",");

                json.append("\"brand\":\"")
                        .append(rs.getString("BRAND"))
                        .append("\",");

                json.append("\"price\":")
                        .append(rs.getDouble("PRICE"))
                        .append(",");

                json.append("\"quantity\":")
                        .append(rs.getInt("QUANTITY"))
                        .append(",");

                json.append("\"expiryDate\":\"")
                        .append(rs.getDate("EXPIRY_DATE"))
                        .append("\"");

                json.append("}");

                first = false;
            }

            json.append("]");

            rs.close();
            pst.close();
            conn.close();

            return json.toString();

        } catch (Exception e) {

            e.printStackTrace();

            return "{\"error\":\"Error retrieving cosmetics\"}";
        }
    }


    // POST - Add a new cosmetic
    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response addCosmetic(String json) {

        try {

            String[] parts = json.replace("{", "")
                    .replace("}", "")
                    .replace("\"", "")
                    .split(",");

            int cosmeticId = Integer.parseInt(
                    parts[0].split(":")[1].trim());

            String cosmeticName = parts[1].split(":")[1].trim();

            String category = parts[2].split(":")[1].trim();

            String brand = parts[3].split(":")[1].trim();

            double price = Double.parseDouble(
                    parts[4].split(":")[1].trim());

            int quantity = Integer.parseInt(
                    parts[5].split(":")[1].trim());

            String expiryDate = parts[6].split(":")[1].trim();


            Connection conn = DatabaseConnection.getConnection();

            String sql = "INSERT INTO COSMETIC VALUES (?, ?, ?, ?, ?, ?, ?)";

            PreparedStatement pst = conn.prepareStatement(sql);

            pst.setInt(1, cosmeticId);
            pst.setString(2, cosmeticName);
            pst.setString(3, category);
            pst.setString(4, brand);
            pst.setDouble(5, price);
            pst.setInt(6, quantity);
            pst.setDate(7, java.sql.Date.valueOf(expiryDate));

            pst.executeUpdate();

            pst.close();
            conn.close();

            return Response.ok(
                    "{\"message\":\"Cosmetic added successfully\"}"
            ).build();

        } catch (Exception e) {

            e.printStackTrace();

            return Response.status(
                    Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(
                    "{\"error\":\"Unable to add cosmetic\"}")
                    .build();
        }
    }


    // GET - Retrieve cosmetic by ID
    @GET
    @Path("/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public String getCosmeticById(
            @PathParam("id") int id) {

        String sql =
                "SELECT * FROM COSMETIC WHERE COSMETIC_ID=?";

        try {

            Connection conn = DatabaseConnection.getConnection();

            PreparedStatement pst =
                    conn.prepareStatement(sql);

            pst.setInt(1, id);

            ResultSet rs = pst.executeQuery();

            if (rs.next()) {

                String json = "{"
                        + "\"cosmeticId\":"
                        + rs.getInt("COSMETIC_ID") + ","

                        + "\"cosmeticName\":\""
                        + rs.getString("COSMETIC_NAME") + "\","

                        + "\"category\":\""
                        + rs.getString("CATEGORY") + "\","

                        + "\"brand\":\""
                        + rs.getString("BRAND") + "\","

                        + "\"price\":"
                        + rs.getDouble("PRICE") + ","

                        + "\"quantity\":"
                        + rs.getInt("QUANTITY") + ","

                        + "\"expiryDate\":\""
                        + rs.getDate("EXPIRY_DATE") + "\""

                        + "}";

                rs.close();
                pst.close();
                conn.close();

                return json;
            }

            rs.close();
            pst.close();
            conn.close();

            return "{\"message\":\"Cosmetic not found\"}";

        } catch (Exception e) {

            e.printStackTrace();

            return "{\"error\":\"Error retrieving cosmetic\"}";
        }
    }


    // PUT - Update complete cosmetic
    @PUT
    @Path("/{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response updateCosmetic(
            @PathParam("id") int id,
            String json) {

        try {

            String[] parts = json.replace("{", "")
                    .replace("}", "")
                    .replace("\"", "")
                    .split(",");

            String cosmeticName =
                    parts[0].split(":")[1].trim();

            String category =
                    parts[1].split(":")[1].trim();

            String brand =
                    parts[2].split(":")[1].trim();

            double price =
                    Double.parseDouble(
                    parts[3].split(":")[1].trim());

            int quantity =
                    Integer.parseInt(
                    parts[4].split(":")[1].trim());

            String expiryDate =
                    parts[5].split(":")[1].trim();


            Connection conn =
                    DatabaseConnection.getConnection();

            String sql =
                    "UPDATE COSMETIC SET "
                    + "COSMETIC_NAME=?, "
                    + "CATEGORY=?, "
                    + "BRAND=?, "
                    + "PRICE=?, "
                    + "QUANTITY=?, "
                    + "EXPIRY_DATE=? "
                    + "WHERE COSMETIC_ID=?";

            PreparedStatement pst =
                    conn.prepareStatement(sql);

            pst.setString(1, cosmeticName);
            pst.setString(2, category);
            pst.setString(3, brand);
            pst.setDouble(4, price);
            pst.setInt(5, quantity);

            pst.setDate(
                    6,
                    java.sql.Date.valueOf(expiryDate));

            pst.setInt(7, id);

            int rows = pst.executeUpdate();

            pst.close();
            conn.close();

            if (rows > 0) {

                return Response.ok(
                        "{\"message\":\"Cosmetic updated successfully\"}"
                ).build();
            }

            return Response.status(
                    Response.Status.NOT_FOUND)
                    .entity(
                    "{\"message\":\"Cosmetic not found\"}")
                    .build();

        } catch (Exception e) {

            e.printStackTrace();

            return Response.status(
                    Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(
                    "{\"error\":\"Unable to update cosmetic\"}")
                    .build();
        }
    }


    // PATCH - Partially update quantity
@PATCH
@Path("/{id}")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public Response updateQuantity(
        @PathParam("id") int id,
        String json) {

        try {

            String quantityText =
                    json.replace("{", "")
                    .replace("}", "")
                    .replace("\"", "")
                    .split(":")[1]
                    .trim();

            int quantity =
                    Integer.parseInt(quantityText);


            Connection conn =
                    DatabaseConnection.getConnection();

            String sql =
                    "UPDATE COSMETIC "
                    + "SET QUANTITY=? "
                    + "WHERE COSMETIC_ID=?";

            PreparedStatement pst =
                    conn.prepareStatement(sql);

            pst.setInt(1, quantity);
            pst.setInt(2, id);

            int rows = pst.executeUpdate();

            pst.close();
            conn.close();

            if (rows > 0) {

                return Response.ok(
                        "{\"message\":\"Cosmetic quantity updated successfully\"}"
                ).build();
            }

            return Response.status(
                    Response.Status.NOT_FOUND)
                    .entity(
                    "{\"message\":\"Cosmetic not found\"}")
                    .build();

        } catch (Exception e) {

            e.printStackTrace();

            return Response.status(
                    Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(
                    "{\"error\":\"Unable to update quantity\"}")
                    .build();
        }
    }
// DELETE - Delete a cosmetic
@DELETE
@Path("/{id}")
@Produces(MediaType.APPLICATION_JSON)
public Response deleteCosmetic(@PathParam("id") int id) {

    try {

        Connection conn = DatabaseConnection.getConnection();

        String sql = "DELETE FROM COSMETIC WHERE COSMETIC_ID=?";

        PreparedStatement pst = conn.prepareStatement(sql);

        pst.setInt(1, id);

        int rows = pst.executeUpdate();

        pst.close();
        conn.close();

        if (rows > 0) {

            return Response.ok(
                    "{\"message\":\"Cosmetic deleted successfully\"}"
            ).build();
        }

        return Response.status(Response.Status.NOT_FOUND)
                .entity("{\"message\":\"Cosmetic not found\"}")
                .build();

    } catch (Exception e) {

        e.printStackTrace();

        return Response.status(
                Response.Status.INTERNAL_SERVER_ERROR)
                .entity(
                "{\"error\":\"Unable to delete cosmetic\"}")
                .build();
    }
}
}