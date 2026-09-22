package com.veloura.api;

import java.sql.Connection;
import java.sql.DriverManager;

public class DatabaseConnection {

    private static final String URL =
            "jdbc:derby://localhost:1527/VelouraDB";

    private static final String USER = "root";
    private static final String PASSWORD = "root";

    public static Connection getConnection() {

        try {

            Class.forName("org.apache.derby.jdbc.ClientDriver");

            return DriverManager.getConnection(
                    URL,
                    USER,
                    PASSWORD
            );

        } catch (Exception e) {

            e.printStackTrace();

            return null;
        }
    }
}