package com.veloura.api;

import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

import javax.ws.rs.HttpMethod;

@Target(METHOD)
@Retention(RUNTIME)
@HttpMethod("PATCH")
public @interface PATCH {
}